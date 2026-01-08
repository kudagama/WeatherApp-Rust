
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
};
use tauri_plugin_notification::NotificationExt;

const API_KEY: &str = "376cbbec5ab9182d5ff3be7a1d538c23";

#[derive(serde::Serialize)]
struct WeatherResponse {
    current: serde_json::Value,
    forecast: serde_json::Value,
}

async fn fetch_weather_data<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    url_current: String,
    url_forecast: String,
) -> Result<String, String> {

    let res_current = reqwest::get(&url_current)
        .await
        .map_err(|e| e.to_string())?
        .json::<serde_json::Value>()
        .await
        .map_err(|e| e.to_string())?;


    let res_forecast = reqwest::get(&url_forecast)
        .await
        .map_err(|e| e.to_string())?
        .json::<serde_json::Value>()
        .await
        .map_err(|e| e.to_string())?;


    if let Some(name) = res_current["name"].as_str() {
        if let Some(temp) = res_current["main"]["temp"].as_f64() {

             let _ = app.get_webview_window("main").expect("main window missing").set_title(&format!("{}: {:.1}°C", name, temp));
        }
    }


    if let Some(weather_array) = res_current["weather"].as_array() {
        if let Some(first) = weather_array.first() {
            if let Some(main) = first["main"].as_str() {
                if matches!(main, "Thunderstorm" | "Rain" | "Snow" | "Extreme") {
                    let city = res_current["name"].as_str().unwrap_or("Unknown City");
                    let _ = app.notification()
                        .builder()
                        .title("Severe Weather Alert")
                        .body(&format!("Warning: {} detected in {}. Stay safe!", main, city))
                        .show();
                }
            }
        }
    }

    let response = WeatherResponse {
        current: res_current,
        forecast: res_forecast,
    };

    serde_json::to_string(&response).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_weather<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    city: String,
) -> Result<String, String> {
    let url_current = format!(
        "https://api.openweathermap.org/data/2.5/weather?q={}&appid={}&units=metric",
        city, API_KEY
    );
    let url_forecast = format!(
        "https://api.openweathermap.org/data/2.5/forecast?q={}&appid={}&units=metric",
        city, API_KEY
    );
    fetch_weather_data(&app, url_current, url_forecast).await
}

#[tauri::command]
async fn get_weather_by_coords<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    lat: f64,
    lon: f64,
) -> Result<String, String> {
    let url_current = format!(
        "https://api.openweathermap.org/data/2.5/weather?lat={}&lon={}&appid={}&units=metric",
        lat, lon, API_KEY
    );
    let url_forecast = format!(
        "https://api.openweathermap.org/data/2.5/forecast?lat={}&lon={}&appid={}&units=metric",
        lat, lon, API_KEY
    );
    fetch_weather_data(&app, url_current, url_forecast).await
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {

            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>).unwrap();
            let menu = Menu::with_items(app, &[&quit_i]).unwrap();
            
            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Weather App")
                .on_menu_event(|app, event| {
                    if event.id() == "quit" {
                        app.exit(0);
                    }
                })
                .build(app)?;
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_weather, get_weather_by_coords])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}