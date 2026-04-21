# Turf Cricket Scorer - Android App

This project wraps your website into a premium Android mobile application using a WebView.

## Features Included:
- **JavaScript Enabled**: Full support for your website's logic.
- **Internet Permission**: Required for loading the website.
- **Back Button Navigation**: Handle navigation within the app (goes back inside the website instead of closing the app).
- **Loading Indicator**: A clean, modern loading bar shows up while the page is loading.
- **Premium Design**: Dark slate theme that matches modern aesthetics.

## How to Generate the APK

### Option 1: Use a Cloud Builder (Easiest - No Software Required)
1. Go to [WebIntoApp](https://www.webintoapp.com/) or [AppsGeyser](https://appsgeyser.com/create-url-app/).
2. Enter your website URL: `https://your-website-link.com`
3. Enter App Name: `Turf Cricket Scorer`
4. Upload an icon (optional).
5. Click **Generate APK** and download it.

### Option 2: Build Locally (If you have Android Studio)
1. Open **Android Studio**.
2. Select **Open an Existing Project** and choose the `android_app` folder.
3. Wait for Gradle to sync.
4. Go to **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
5. The APK will be generated in `app/build/outputs/apk/debug/app-debug.apk`.

### Option 3: Use GitHub Actions (Professional)
If you push this code to a GitHub repository, you can add a `.github/workflows/android.yml` file to automatically build the APK for you every time you push code.

## Configuration
To update the website URL, edit the `URL` variable in:
`app/src/main/java/com/turfcricket/scorer/MainActivity.java`
