# FreeKiosk Monitor Setup Guide

Setup guide for Android monitors running FreeKiosk to display PlayStation session notifications.

## Prerequisites (One-time Setup)

- **ADB tools**: `C:\Users\shark\Downloads\platform-tools\`
- **FreeKiosk APK**: `C:\Users\shark\Downloads\freekiosk-v1.2.1.apk`
- **PC route to guest network**: Already configured via `route add 10.10.10.0 mask 255.255.255.0 192.168.1.109 -p`

## Per-Monitor Setup Steps

### Step 1: Connect Monitor to WiFi

Connect the Android monitor to **aboyassen hotspot** (10.10.10.x network)

### Step 2: Find Monitor IP & MAC Address

Check MikroTik for the new device:

```bash
curl -s -u admin:need4speed "http://192.168.1.109/rest/ip/hotspot/host"
```

Look for the new device and note its `address` and `mac-address`.

### Step 3: Enable USB Debugging on Monitor

1. Go to **Settings → About**
2. Tap **"Build Number"** 7 times until developer mode is enabled
3. Go to **Settings → Developer Options**
4. Enable **USB Debugging**
5. Enable **ADB over network** (if available)

### Step 4: Bypass Monitor from Hotspot Authentication

Replace `XX:XX:XX:XX:XX:XX` with the monitor's MAC address:

```bash
curl -s -u admin:need4speed -X POST "http://192.168.1.109/rest/ip/hotspot/ip-binding/add" \
  -H "Content-Type: application/json" \
  -d '{
    "mac-address": "XX:XX:XX:XX:XX:XX",
    "type": "bypassed",
    "comment": "FreeKiosk Monitor - PS Station X"
  }'
```

### Step 5: Block Internet Access (LAN Only)

Replace `10.10.10.XXX` with the monitor's IP:

```bash
curl -s -u admin:need4speed -X POST "http://192.168.1.109/rest/ip/firewall/filter/add" \
  -H "Content-Type: application/json" \
  -d '{
    "chain": "forward",
    "action": "drop",
    "src-address": "10.10.10.XXX",
    "out-interface-list": "WAN",
    "comment": "Block internet for FreeKiosk monitor - PS Station X"
  }'
```

### Step 6: Connect via ADB & Install FreeKiosk

Replace `10.10.10.XXX` with the monitor's IP:

```bash
# Connect to monitor
C:\Users\shark\Downloads\platform-tools\adb.exe connect 10.10.10.XXX:5555

# Accept the authorization prompt on the monitor screen!

# Install FreeKiosk APK
C:\Users\shark\Downloads\platform-tools\adb.exe -s 10.10.10.XXX:5555 install "C:\Users\shark\Downloads\freekiosk-v1.2.1.apk"

# Launch the app
C:\Users\shark\Downloads\platform-tools\adb.exe -s 10.10.10.XXX:5555 shell am start -n com.freekiosk/.MainActivity
```

### Step 7: Configure FreeKiosk App

1. **Tap 5 times** quickly anywhere on screen to open settings
2. Enter PIN: **1234** (default)
3. Enable **REST API** (under Settings or API section)
4. **Save** and exit settings (app must be in kiosk mode for API to work)

### Step 8: Test Connection

Replace `10.10.10.XXX` with the monitor's IP:

```bash
# Test beep
curl -s -X POST "http://10.10.10.XXX:8080/api/audio/beep"

# Test TTS
curl -s -X POST "http://10.10.10.XXX:8080/api/tts" -H "Content-Type: application/json" -d '{"text":"تم الاتصال بنجاح"}'
```

### Step 9: Add to Dashboard

1. Go to **http://localhost:3000/playstation/settings**
2. Edit the PlayStation station
3. Set **Monitor IP**: `10.10.10.XXX`
4. Set **Port**: `8080`
5. Click **Test** button to verify connection

---

## FreeKiosk API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/status` | GET | Get device status |
| `/api/screen/on` | POST | Turn screen on |
| `/api/screen/off` | POST | Turn screen off |
| `/api/brightness` | POST | Set brightness `{"value": 0-100}` |
| `/api/audio/beep` | POST | Play beep sound |
| `/api/tts` | POST | Text-to-speech `{"text": "message"}` |
| `/api/volume` | POST | Set volume `{"value": 0-100}` |

---

## Automatic Notifications

Once configured, the dashboard will automatically:

- **Session Start**: Screen on + beep + TTS "بدأت الجلسة على [Station]، الوقت [X] دقيقة"
- **Timer Expired**: 3 beeps + TTS "انتهى الوقت! انتهت الجلسة على [Station]"
- **Session End**: TTS "انتهت الجلسة على [Station]" + Screen off

---

## Troubleshooting

### Can't ping monitor
- Check if monitor is connected to WiFi
- Verify PC has route: `route print | findstr 10.10.10`
- Check MikroTik hotspot hosts for the device

### ADB connection refused
- Enable USB Debugging in Developer Options
- Enable ADB over network
- Check if another ADB session is connected

### FreeKiosk API not responding
- Make sure app is running (not in settings screen)
- REST API must be enabled in FreeKiosk settings
- App must be in kiosk mode (exit settings)

### Monitor has no network access
- Add IP binding bypass on MikroTik (Step 4)
- Check firewall rules aren't blocking LAN traffic
