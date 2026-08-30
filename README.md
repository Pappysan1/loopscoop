# Loop Scoop

Any photo, scaled to your hoop. Client-side embroidery studio.

## Run (web)

```
npm install
npm run dev
```

Open `http://localhost:3000`. On a phone on the same Wi-Fi, use the PC’s LAN address shown in the header.

## Print

- **Print on paper** — system printer list (AirPrint on iPhone, Windows printers, Android Print Manager).
- **Save PDF / Share** — letter-size hoop cover, tiled chart, floss key.
- **Bluetooth thermal** — Chrome on PC/Android (not iOS Safari).

## Windows portable exe

```
npm run dist:win
```

Output: `release/LoopScoop-Portable.exe`

## Android APK

After the web app builds, Capacitor Android is added in a later packaging step (`npx cap add android`). Sideload the debug APK from `release/`.
