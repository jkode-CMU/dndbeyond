import { useState, useEffect, useRef, forwardRef, useCallback, useMemo, memo } from 'react';
import { ArrowLeft, ArrowRight, RotateCw, ExternalLink } from 'lucide-react';
import { Save, FileText, Plus, Trash2, Star } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import DOMPurify from 'dompurify';
import ConfirmModal from '../components/ConfirmModal';
import { invoke } from '@tauri-apps/api/core';
import { open as tauriOpen } from '@tauri-apps/plugin-shell';
import { Character } from '../types/character';

interface Note {
  id: string;
  title: string;
  content: string;
  characterId?: string;
  pinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'campaign-notes';

// Editor wrapper with stable identity to avoid remounts when parent re-renders
const QuillWithLoggingInner = forwardRef((props: any, ref: any) => {
  const { value } = props;
  useEffect(() => {
    console.debug('[NotesPage] QuillWithLogging mounted');
    return () => console.debug('[NotesPage] QuillWithLogging unmounted');
  }, []);
  useEffect(() => {
    console.debug('[NotesPage] QuillWithLogging value length', String(value).length);
  }, [value]);
  return <ReactQuill ref={ref} {...props} />;
});

const QuillWithLogging = memo(QuillWithLoggingInner);

export default function NotesPage() {
  // Toggle this to true to disable debounced persistence (useful for debugging disappearance)
  const DEBUG_DISABLE_DEBOUNCE = false;


  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const selectedNote = notes.find(n => n.id === selectedNoteId) || null;
  const [showPreview, setShowPreview] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [characterFilter, setCharacterFilter] = useState<string>('all');
  const [savedStatus, setSavedStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [openExternalByDefault, setOpenExternalByDefault] = useState<boolean>(() => {
    try {
      return localStorage.getItem('notes-open-external-default') === 'true';
    } catch (e) {
      return false;
    }
  });
  const quillRef = useRef<any>(null);
  const quillSelectionRef = useRef<any>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState<string>('');
  const [previewTabUrl, setPreviewTabUrl] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // render instrumentation to help diagnose unexpected remounts
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;
  console.debug('[NotesPage] render', renderCountRef.current, { selectedNoteId, showPreview, previewTabUrl, editorContentLength: (editorContent || '').length });

  // derived boolean describing whether the editor should be visible in the tree
  // NOTE: intentionally do NOT include previewTabUrl here so opening the in-app viewer
  // does not remove the editor from the DOM and reset Quill's selection/caret.
  const showingEditor = Boolean(selectedNote && !showPreview);
  const prevShowingRef = useRef<boolean>(showingEditor);
  useEffect(() => {
    if (prevShowingRef.current !== showingEditor) {
      console.debug('[NotesPage] showingEditor flipped', prevShowingRef.current, '->', showingEditor, { selectedNoteId, showPreview });
      prevShowingRef.current = showingEditor;
    }
  }, [showingEditor, selectedNoteId, showPreview]);

  // keep previous notes snapshot to compare changes
  const notesPrevRef = useRef<Note[] | null>(null);
  useEffect(() => {
    const prev = notesPrevRef.current;
    if (prev) {
      if (prev.length !== notes.length) {
        console.debug('[NotesPage] notes length changed', prev.length, '->', notes.length, 'selectedNoteId', selectedNoteId);
      } else {
        // check if selected note content length changed
        try {
          const prevSel = prev.find(n => n.id === selectedNoteId);
          const nextSel = notes.find(n => n.id === selectedNoteId);
          if ((prevSel?.content || '').length !== (nextSel?.content || '').length) {
            console.debug('[NotesPage] selectedNote content length changed', (prevSel?.content || '').length, '->', (nextSel?.content || '').length, 'selectedNoteId', selectedNoteId);
          }
        } catch (err) {
          // ignore
        }
      }
    }
    notesPrevRef.current = notes;
  }, [notes, selectedNoteId]);

  useEffect(() => {
    // load notes from localStorage
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setNotes(JSON.parse(raw));
    } catch (e) {
      console.error('Failed to load notes', e);
    }
    // load characters if available
    (async () => {
      try {
        const list = await invoke('load_characters');
        if (Array.isArray(list)) setCharacters(list as Character[]);
      } catch (e) {
        // ignore - desktop may not have backend available in some contexts
      }
    })();
  }, []);

  useEffect(() => {
    // persist notes with a short debounce
    setSavedStatus('saving');
    const t = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
      setSavedStatus('saved');
    }, 600);
    return () => clearTimeout(t);
  }, [notes]);

  useEffect(() => {
    try {
      localStorage.setItem('notes-open-external-default', openExternalByDefault ? 'true' : 'false');
    } catch (e) {
      // ignore
    }
  }, [openExternalByDefault]);

  const createNote = useCallback(() => {
    const n: Note = {
      id: Date.now().toString(36),
      title: 'Untitled',
      content: '',
      pinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setNotes(s => {
      const next = [n, ...s];
      console.debug('[NotesPage] createNote — prevLen->nextLen', s.length, '->', next.length, 'newId', n.id, 'selectedNoteId', selectedNoteId);
      return next;
    });
    setSelectedNoteId(n.id);
    setSavedStatus('unsaved');
    console.debug('[NotesPage] createNote', n.id);
  }, [setNotes, setSelectedNoteId]);

  const updateNote = useCallback((id: string, patch: Partial<Note>) => {
    console.debug('[NotesPage] updateNote (requested)', id, patch);
    setNotes(s => {
      const next = s.map(n => n.id === id ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n);
      try {
        const prevNote = s.find(n => n.id === id);
        const nextNote = next.find(n => n.id === id);
        console.debug('[NotesPage] updateNote applied — prevContentLen,nextContentLen', prevNote ? (prevNote.content || '').length : 'NA', nextNote ? (nextNote.content || '').length : 'NA', 'selectedNoteId', selectedNoteId);
      } catch (err) {
        // ignore logging errors
      }
      return next;
    });
    setSavedStatus('unsaved');
  }, [setNotes]);

  const confirmDeleteNote = (id: string) => {
    setConfirmDeleteNoteId(id);
  };

  const cancelDeleteNote = () => setConfirmDeleteNoteId(null);

  const doDeleteNote = useCallback((id: string) => {
    setNotes(s => {
      const next = s.filter(n => n.id !== id);
      console.debug('[NotesPage] doDeleteNote — prevLen->nextLen', s.length, '->', next.length, 'deleted', id, 'selectedNoteId', selectedNoteId);
      return next;
    });
    if (selectedNoteId === id) setSelectedNoteId(null);
    setConfirmDeleteNoteId(null);
    setSavedStatus('unsaved');
  }, [selectedNoteId, setNotes]);

  const togglePin = useCallback((id: string) => updateNote(id, { pinned: !notes.find(n => n.id === id)?.pinned }), [updateNote, notes]);

  // ReactQuill configuration (memoized to keep stable identity)
  const modules = useMemo(() => ({
    toolbar: {
      container: [
        ['bold', 'italic', 'underline'],
        [{ size: ['small', false, 'large', 'huge'] }],
        [{ background: [] }],
        ['link'],
        ['clean']
      ],
      handlers: {
        link: function(this: any) {
          const editor = quillRef.current?.getEditor();
          if (editor) {
            quillSelectionRef.current = editor.getSelection(true);
            setLinkUrl('');
            setLinkModalOpen(true);
          }
        }
      }
    },
    history: { delay: 1000, maxStack: 100, userOnly: true }
  } as any), [setLinkUrl, setLinkModalOpen]);

  const formats = useMemo(() => ['bold', 'italic', 'underline', 'size', 'background', 'link'], []);

  // Font size and highlight formatting are handled within the editor's toolbar.

  const confirmLink = useCallback(() => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;
    const sel = quillSelectionRef.current || editor.getSelection(true);
    if (!sel) return;
    editor.setSelection(sel.index, sel.length || 0, 'silent');
    editor.format('link', linkUrl || null, 'user');
    setLinkModalOpen(false);
    setLinkUrl('');
    if (selectedNote) updateNote(selectedNote.id, { content: editor.root.innerHTML });
  }, [linkUrl, selectedNote, updateNote]);

  const onQuillChange = useCallback((html: string) => {
    // Only update state if content actually changed to avoid extra re-renders
    if (html !== editorContent) {
      console.debug('[NotesPage] onQuillChange length', String((html || '').length));
      setEditorContent(html);
      setSavedStatus('unsaved');
    }
  }, [editorContent]);

  const onQuillSelectionChange = useCallback((range: any) => {
    // store selection so link handler can restore it
    if (range) {
      quillSelectionRef.current = range;
    }
    // debug selection changes
    // console.debug('[NotesPage] selection', range);
  }, []);

  // focus the editor when a note is selected so typing works for new/empty notes
  useEffect(() => {
    if (!selectedNote) return;
    // sync editorContent from selected note when selection changes
    setEditorContent(selectedNote.content ?? '');

    const ed = quillRef.current?.getEditor?.();
    if (ed && typeof ed.focus === 'function') {
      // slight delay to ensure Quill has mounted
      setTimeout(() => ed.focus(), 50);
    }
  }, [selectedNoteId]);

  // debounce persisting editor content into notes to avoid frequent re-renders
  useEffect(() => {
    if (!selectedNote) return;
    if (DEBUG_DISABLE_DEBOUNCE) {
      // Persist directly to localStorage (no React state update) while debugging to avoid re-renders
      console.debug('[NotesPage] DEBUG_DISABLE_DEBOUNCE enabled - persisting directly to localStorage for', selectedNote.id, 'editor length', editorContent.length);
      try {
        const snapshot = notes.map(n => n.id === selectedNote.id ? { ...n, content: editorContent, updatedAt: new Date().toISOString() } : n);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
        setSavedStatus('saved');
      } catch (e) {
        console.error('Failed to persist debug content', e);
      }
      return;
    }
    const t = setTimeout(() => {
      // only update if content changed
      console.debug('[NotesPage] debounced save for', selectedNote.id, 'editor length', editorContent.length);
      if (selectedNote.content !== editorContent) updateNote(selectedNote.id, { content: editorContent });
    }, 500);
    return () => clearTimeout(t);
  }, [editorContent, selectedNoteId]);

  useEffect(() => {
    console.debug('[NotesPage] notes length', notes.length, 'selected', selectedNoteId);
  }, [notes, selectedNoteId]);

  // keep a simple mount counter for the Quill wrapper to detect unexpected remounts
  const quillMountsRef = useRef(0);
  useEffect(() => {
    // increment when editorContent changes and Quill is mounted
    if (quillRef.current?.getEditor) {
      // best-effort: increment and log
      quillMountsRef.current += 0; // no-op placeholder to keep ref stable
    }
  }, [editorContent]);

  const sanitizedContent = (content: string) => {
    // If content looks like HTML, sanitize it; otherwise treat as markdown
    if (!content) return '';
    const looksLikeHtml = /<[^>]+>/.test(content);
    if (looksLikeHtml) {
      const clean = DOMPurify.sanitize(content, {
        ALLOWED_TAGS: [
            'p', 'br', 'strong', 'em', 'u', 'a', 'span', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code'
        ],
        ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style'],
      });
      // ensure links open in a new tab and are safe
      try {
        const d = document.createElement('div');
        d.innerHTML = clean;
        const anchors = d.querySelectorAll('a');
        anchors.forEach(a => {
          a.setAttribute('target', '_self');
          // add noopener noreferrer for security
          a.setAttribute('rel', 'noopener noreferrer');
          // style links to be blue and underlined in preview
          const style = a.getAttribute('style') || '';
          // prefer a clear blue that matches Tailwind's blue-600
          a.setAttribute('style', style + ';color:#2563eb;text-decoration:underline;');
        });
        return d.innerHTML;
      } catch (e) {
        return clean;
      }
    }
    return DOMPurify.sanitize(String(content));
  };

  // Intercept clicks in the preview and open external links in the system browser (Tauri),
  // falling back to window.open for web. We dynamic-import the Tauri shell to avoid
  // static module resolution and to keep web builds working.
  const openPreviewUrl = useCallback((href: string) => {
    // respect user preference to open external by default
    if (openExternalByDefault) {
      openExternally(href);
      return;
    }
    setPreviewTabUrl(href);
  }, [openExternalByDefault]);

  const handlePreviewClick = useCallback((e: any) => {
    try {
      let el = e.target as HTMLElement | null;
      while (el && el !== e.currentTarget) {
        if (el.tagName === 'A') {
          const href = (el as HTMLAnchorElement).getAttribute('href');
          if (!href) return;
          e.preventDefault();
          openPreviewUrl(href);
          return;
        }
        el = el.parentElement;
      }
    } catch (err) {
      // swallow errors
    }
  }, [openPreviewUrl, openExternalByDefault]);

  const viewerBack = useCallback(() => {
    try {
      iframeRef.current?.contentWindow?.history.back();
    } catch (err) {
      console.error('Failed to go back in iframe history', err);
    }
  }, []);

  const viewerForward = useCallback(() => {
    try {
      iframeRef.current?.contentWindow?.history.forward();
    } catch (err) {
      console.error('Failed to go forward in iframe history', err);
    }
  }, []);

  const viewerReload = useCallback(() => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  }, []);

  const openExternally = useCallback(async (url?: string) => {
    let target = url || previewTabUrl;
    if (!target) return;
    // prefer the iframe's current location if accessible
    try {
      const win = iframeRef.current?.contentWindow;
      if (win && typeof win.location?.href === 'string') target = win.location.href;
    } catch (err) {
      // ignore
    }

    // Try native Tauri open first (plugin-shell). If it fails (not running
    // in Tauri), fall back to opening in a browser tab.
    try {
      await tauriOpen(target);
      return;
    } catch (err) {
      console.debug('[NotesPage] tauri plugin-shell.open failed, falling back to window.open', err);
    }

    try {
      window.open(target, '_blank', 'noopener,noreferrer');
    } catch (err2) {
      console.error('Failed to open link in new tab', err2);
      window.location.href = target;
    }
  }, [previewTabUrl]);



  const filteredNotes = notes.filter(n => {
    if (characterFilter !== 'all' && n.characterId !== characterFilter) return false;
    if (!searchTerm) return true;
    const t = (n.title + ' ' + (n.content || '')).toLowerCase();
    return t.includes(searchTerm.toLowerCase());
  });

  const pinnedNotes = filteredNotes.filter(n => n.pinned);
  const unpinnedNotes = filteredNotes.filter(n => !n.pinned);

  return (
    <div className="h-full flex">
      {/* Left list */}
      <div className="w-96 border-r border-gray-200 dark:border-gray-800 flex flex-col">
        <div className="px-3 py-2">
          <div className="flex items-center gap-2">
            <button onClick={createNote} className="px-3 py-1 bg-primary text-white rounded flex items-center gap-2">
              <Plus className="w-4 h-4" /> New
            </button>
            <select value={characterFilter} onChange={(e) => setCharacterFilter(e.target.value)} className="ml-2 px-2 py-1 text-sm bg-white dark:bg-gray-800 border rounded">
              <option value="all">All</option>
              {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="mt-2">
            <input
              className="w-full px-2 py-1 border rounded bg-white dark:bg-gray-800 text-sm"
              placeholder="Search notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {pinnedNotes.length > 0 && (
            <div className="px-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Pinned</div>
          )}

          {pinnedNotes.map(note => (
            <div key={note.id} onClick={() => setSelectedNoteId(note.id)} className={`p-3 rounded-lg cursor-pointer transition-colors ${selectedNote?.id === note.id ? 'bg-primary text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-medium truncate">{note.title}</div>
                    {note.characterId && (
                      <div className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-2 py-0.5 rounded">
                        {characters.find(c => c.id === note.characterId)?.name || 'Unknown'}
                      </div>
                    )}
                  </div>
                  <div className="text-sm opacity-75 truncate mt-1">
                    {(() => {
                      const d = document.createElement('div');
                      d.innerHTML = note.content || '';
                      const text = (d.textContent || '').replace(/\u00A0/g, ' ');
                      return text.length > 80 ? text.slice(0, 80) + '...' : text;
                    })()}
                  </div>
                  <div className="text-xs opacity-60 mt-1">{new Date(note.updatedAt).toLocaleDateString()}</div>
                </div>
                <div className="flex items-center ml-2 gap-1">
                  <button onClick={(e) => { e.stopPropagation(); togglePin(note.id); }} className="p-1 rounded hover:bg-yellow-50 dark:hover:bg-yellow-900" title={note.pinned ? 'Unpin note' : 'Pin note'}>
                    <Star className={`w-4 h-4 ${note.pinned ? 'text-yellow-400' : 'text-gray-400'}`} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); confirmDeleteNote(note.id); }} className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))}

          {unpinnedNotes.length > 0 && (
            <div className="px-3 mt-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Notes</div>
          )}

          {unpinnedNotes.map(note => (
            <div key={note.id} onClick={() => setSelectedNoteId(note.id)} className={`p-3 rounded-lg cursor-pointer transition-colors ${selectedNote?.id === note.id ? 'bg-primary text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-medium truncate">{note.title}</div>
                    {note.characterId && (
                      <div className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-2 py-0.5 rounded">
                        {characters.find(c => c.id === note.characterId)?.name || 'Unknown'}
                      </div>
                    )}
                  </div>
                  <div className="text-sm opacity-75 truncate mt-1">
                    {(() => {
                      const d = document.createElement('div');
                      d.innerHTML = note.content || '';
                      const text = (d.textContent || '').replace(/\u00A0/g, ' ');
                      return text.length > 80 ? text.slice(0, 80) + '...' : text;
                    })()}
                  </div>
                  <div className="text-xs opacity-60 mt-1">{new Date(note.updatedAt).toLocaleDateString()}</div>
                </div>
                <div className="flex items-center ml-2 gap-1">
                  <button onClick={(e) => { e.stopPropagation(); togglePin(note.id); }} className="p-1 rounded hover:bg-yellow-50 dark:hover:bg-yellow-900" title={note.pinned ? 'Unpin note' : 'Pin note'}>
                    <Star className={`w-4 h-4 ${note.pinned ? 'text-yellow-400' : 'text-gray-400'}`} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); confirmDeleteNote(note.id); }} className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))}

          {notes.length === 0 && (
            <div className="text-center py-8 text-gray-500">No notes yet. Create one to get started!</div>
          )}
        </div>

        <div className="p-4 border-t border-gray-300 dark:border-gray-700">
            <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {savedStatus === 'saving' && <span className="text-gray-500">Saving...</span>}
              {savedStatus === 'saved' && <span className="text-green-500 flex items-center gap-1"><Save className="w-4 h-4" />Saved</span>}
              {savedStatus === 'unsaved' && <span className="text-yellow-500">Unsaved changes</span>}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOpenExternalByDefault(v => !v)}
                aria-pressed={openExternalByDefault}
                title="Toggle opening preview links externally by default"
                className={`px-2 py-1 border rounded text-sm ${openExternalByDefault ? 'bg-gray-900 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                <ExternalLink className="w-4 h-4 inline mr-1" />{openExternalByDefault ? 'Open external: On' : 'Open external: Off'}
              </button>
              <button onClick={() => setShowPreview(!showPreview)} className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:opacity-90 transition-opacity">
                <FileText className="w-4 h-4 inline mr-1" />{showPreview ? 'Edit' : 'Preview'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Editor */}
      <div className="flex-1 flex">
        {selectedNote ? (
          <div className="flex-1 flex flex-col">
            <div className="p-4 border-b border-gray-300 dark:border-gray-700 relative z-20 bg-white dark:bg-gray-900">
              <input type="text" value={selectedNote.title} onChange={(e) => updateNote(selectedNote.id, { title: e.target.value })} className="w-full text-2xl font-bold bg-transparent text-gray-900 dark:text-white border-none focus:outline-none" placeholder="Note title..." />
            </div>

            <div className="p-4 border-b border-gray-300 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <select value={selectedNote.characterId ?? ''} onChange={(e) => updateNote(selectedNote.id, { characterId: e.target.value || undefined })} className="px-2 py-1 border rounded bg-white dark:bg-gray-700 text-sm">
                  <option value="">No character</option>
                  {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>

                <button onClick={() => togglePin(selectedNote.id)} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800" title={selectedNote.pinned ? 'Unpin note' : 'Pin note'}>
                  <Star className={`w-5 h-5 ${selectedNote.pinned ? 'text-yellow-400' : 'text-gray-400'}`} />
                </button>

                {/* Editor-specific controls (font size, highlight, link) were removed from the top toolbar
                    to avoid duplication with the editor's built-in toolbar. Keep only character selector and pin here. */}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {showPreview ? (
                <div className="p-6 max-w-none ql-snow ql-editor" onClick={handlePreviewClick}>
                      {(() => {
                        const contentToShow = (editorContent && editorContent.length > 0) ? editorContent : (selectedNote.content || '');
                        return contentToShow && /<[^>]+>/.test(contentToShow) ? (
                          <div dangerouslySetInnerHTML={{ __html: sanitizedContent(contentToShow) }} />
                        ) : (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{contentToShow}</ReactMarkdown>
                        );
                      })()}
                </div>
              ) : (
                <div className="p-4 h-full">
                  <QuillWithLogging
                    ref={quillRef}
                    value={editorContent ?? ''}
                    onChange={onQuillChange}
                    onChangeSelection={onQuillSelectionChange}
                    modules={modules}
                    formats={formats}
                    theme="snow"
                    className="h-full"
                    placeholder="Start typing..."
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">Select or create a note to get started</div>
        )}
      </div>

      <ConfirmModal open={!!confirmDeleteNoteId} title="Delete Note" message="Are you sure you want to delete this note? This action cannot be undone." onConfirm={() => doDeleteNote(confirmDeleteNoteId as string)} onCancel={cancelDeleteNote} />

      {/* Link modal */}
      {linkModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-900 p-4 rounded shadow-lg w-96">
            <div className="font-semibold mb-2">Insert link</div>
            <input className="w-full px-2 py-1 mb-3 bg-gray-100 dark:bg-gray-800 rounded" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://example.com" />
            <div className="flex justify-end gap-2">
              <button className="px-3 py-1" onClick={() => { setLinkModalOpen(false); setLinkUrl(''); }}>Cancel</button>
              <button className="px-3 py-1 bg-primary text-white rounded" onClick={confirmLink}>Insert</button>
            </div>
          </div>
        </div>
      )}

      {/* In-app viewer overlay — keep editor mounted while this is open */}
      {previewTabUrl && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-6">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setPreviewTabUrl(null)} />
          <div className="relative w-full max-w-5xl h-[80vh] bg-white dark:bg-gray-900 rounded shadow-lg overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900">
              <div className="flex items-center gap-2">
                <button onClick={viewerBack} title="Back" className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"><ArrowLeft className="w-4 h-4" /></button>
                <button onClick={viewerForward} title="Forward" className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"><ArrowRight className="w-4 h-4" /></button>
                <button onClick={viewerReload} title="Reload" className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"><RotateCw className="w-4 h-4" /></button>
                <button onClick={() => openExternally()} title="Open externally" className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"><ExternalLink className="w-4 h-4" /></button>
                <button onClick={() => setPreviewTabUrl(null)} className="ml-2 px-3 py-1 border rounded">Close</button>
                <div className="font-medium truncate max-w-lg ml-2">{previewTabUrl}</div>
              </div>
              <div className="text-sm opacity-70">In-app viewer</div>
            </div>
            <div className="w-full h-full">
              <iframe ref={iframeRef} src={previewTabUrl ?? undefined} title="Preview" className="w-full h-full border-0" sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
