# Little Fox Training

A standalone browser app for tracking diaper inventory, daily training logs, calendar events, sleep trends, and supply expenses.

## Run

Open `index.html` in a browser. No install step is required.

## Streamlit Community Cloud

This repo can also run on Streamlit Community Cloud using `streamlit_app.py`.

1. Upload all files in this folder to GitHub.
2. Sign in at `share.streamlit.io`.
3. Create a new app from the GitHub repo.
4. Use `streamlit_app.py` as the app file.
5. Deploy.

The Streamlit version wraps the same local HTML app. It still auto-saves to the browser storage on the device you use.

## Features

- Dashboard with stock, wet logs, sleep wet logs, and spending totals.
- Diaper inventory with searchable diaper styles.
- Add new diaper brands/styles/sizes.
- Add diapers by case and automatically record diaper spending.
- Daily log for wet, messed, or dry events with timestamp, subcategories for while sleeping, leaked in bed, leaked while awake, daytime, night accident, day accident, diaper used, and notes.
- Calendar month view with previous/next navigation and day-based log creation.
- Trend charts for wet, messed, leaks, accidents, dry mornings, sleep summaries, diaper usage, and diaper usage by time of day.
- Expense tracking for diaper cases, baby powder, changing pads, wipes, creams, bags, clothing, and other supplies.
- Export/import JSON backups.
- Private mode to hide dollar amounts on screen.
- Auto-saves to local browser storage after each log, inventory change, expense, import, or setting update.
- Local browser storage; no server or account required.

## Notes

Data auto-saves in the browser's local storage on the device you are using. Export a backup before clearing browser data, changing browsers, or switching phones.
