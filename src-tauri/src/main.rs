// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

#[derive(Serialize, Deserialize)]
pub struct Character {
    pub id: String,
    pub name: String,
    pub race: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subrace: Option<String>,
    pub class: String,
    pub background: String,
    #[serde(default = "default_alignment")]
    pub alignment: String,
    pub level: u8,
    pub ability_scores: AbilityScores,
    pub hit_points: u16,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_hit_points: Option<u16>,
    pub armor_class: u8,
    pub initiative: i8,
    pub equipment: Vec<String>,
    pub spells: Vec<String>,
    pub spell_slots: Vec<u8>,
    pub notes: String,
    #[serde(default)]
    pub saving_throw_proficiencies: HashMap<String, u8>,
    #[serde(default)]
    pub skill_proficiencies: HashMap<String, u8>,
    #[serde(default)]
    pub armor_proficiencies: Vec<String>,
    #[serde(default)]
    pub weapon_proficiencies: Vec<String>,
    #[serde(default)]
    pub tool_proficiencies: Vec<String>,
    #[serde(default)]
    pub languages: Vec<String>,
    #[serde(default)]
    pub heroic_inspiration: bool,
    #[serde(default)]
    pub used_abilities: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub currency: Option<Currency>,
}

#[derive(Serialize, Deserialize)]
pub struct Currency {
    #[serde(default)]
    pub platinum: u32,
    #[serde(default)]
    pub gold: u32,
    #[serde(default)]
    pub silver: u32,
    #[serde(default)]
    pub copper: u32,
}

// Default alignment for older characters that don't have the field
fn default_alignment() -> String {
    "Neutral".to_string()
}

#[derive(Serialize, Deserialize)]
pub struct AbilityScores {
    pub strength: u8,
    pub dexterity: u8,
    pub constitution: u8,
    pub intelligence: u8,
    pub wisdom: u8,
    pub charisma: u8,
}

// Get the characters directory path
fn get_characters_dir() -> PathBuf {
    let mut path = dirs::data_dir().unwrap();
    path.push("dnd-beyond-desktop");
    path.push("characters");
    path
}

// Create characters directory if it doesn't exist
fn ensure_characters_dir() -> std::io::Result<()> {
    let dir = get_characters_dir();
    fs::create_dir_all(&dir)?;
    Ok(())
}

// Load all characters from the characters directory
#[tauri::command]
fn load_characters() -> Result<Vec<Character>, String> {
    let dir = get_characters_dir();
    
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut characters = Vec::new();
    
    for entry in fs::read_dir(&dir).map_err(|e| format!("Failed to read directory: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        
        if path.extension().and_then(|s| s.to_str()) == Some("json") {
            let content = fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read file {}: {}", path.display(), e))?;
            
            let character: Character = serde_json::from_str(&content)
                .map_err(|e| format!("Failed to parse character: {}", e))?;
            
            characters.push(character);
        }
    }

    Ok(characters)
}

// Save a character to file
#[tauri::command]
fn save_character(character: Character) -> Result<(), String> {
    ensure_characters_dir().map_err(|e| format!("Failed to create directory: {}", e))?;
    
    let dir = get_characters_dir();
    let filename = format!("{}.json", character.id);
    let path = dir.join(&filename);
    
    let content = serde_json::to_string_pretty(&character)
        .map_err(|e| format!("Failed to serialize character: {}", e))?;
    
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write file: {}", e))?;
    
    Ok(())
}

// Delete a character file
#[tauri::command]
fn delete_character(id: String) -> Result<(), String> {
    let dir = get_characters_dir();
    let filename = format!("{}.json", id);
    let path = dir.join(&filename);
    
    if path.exists() {
        fs::remove_file(&path)
            .map_err(|e| format!("Failed to delete file: {}", e))?;
    }
    
    Ok(())
}

// Get the characters directory path for export
#[tauri::command]
fn get_characters_directory() -> Result<String, String> {
    Ok(get_characters_dir().to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            load_characters,
            save_character,
            delete_character,
            get_characters_directory
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}
