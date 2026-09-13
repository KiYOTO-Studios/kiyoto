# KiYOTO Waitlist Automation Setup Guide

This guide explains how to connect your KiYOTO website waitlist directly to `contactkiyoto@gmail.com` using Google Sheets & Google Apps Script (100% Free, no monthly service fees).

---

## What This System Does

1. **Collects Emails**: When a visitor clicks "Join the wait" on the website, their email is instantly saved to a Google Sheet (`Subscribers`).
2. **Instant Welcome Email**: It immediately emails the subscriber from `contactkiyoto@gmail.com` saying *"You are on the list."*
3. **Automated Broadcast**:
   - **Method A (Email from Gmail)**: Send an email from `contactkiyoto@gmail.com` with the subject starting with `[KiYOTO Broadcast] <Your Announcement>`. The automated trigger will forward it to all waitlist subscribers.
   - **Method B (1-Click from Google Sheets)**: Open your Google Sheet, click **KiYOTO Waitlist > Send Broadcast from Gmail Draft**, pick any draft you created in Gmail, and it sends to all subscribers!

---

## 3-Minute Setup Instructions

### Step 1: Create the Google Sheet
1. Go to [Google Sheets](https://sheets.new) while logged into `contactkiyoto@gmail.com`.
2. Name the sheet **KiYOTO Waitlist**.

### Step 2: Paste the Automation Script
1. In Google Sheets, click **Extensions > Apps Script** in the top menu.
2. Delete any default code in `Code.gs`.
3. Open [`waitlist-automation/GoogleAppsScript.js`](GoogleAppsScript.js) and copy the entire code.
4. Paste it into `Code.gs` and click the **Save** icon (disk icon).

### Step 3: Deploy as Web App
1. In Apps Script, click the blue **Deploy** button at the top right > **New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Fill in the fields:
   - **Description**: `KiYOTO Waitlist Webhook`
   - **Execute as**: `Me (contactkiyoto@gmail.com)`
   - **Who has access**: `Anyone` *(Crucial so visitors on the website can submit their email)*
4. Click **Deploy**.
5. Google will ask you to **Authorize Access**:
   - Click *Review permissions*
   - Choose `contactkiyoto@gmail.com`
   - If you see "Google hasn't verified this app", click *Advanced* > *Go to KiYOTO Waitlist (unsafe)*
   - Click *Allow*.
6. Copy the **Web App URL** (it looks like `https://script.google.com/macros/s/AKfycb.../exec`).

### Step 4: Link to Website
1. Open `index.html` (and `kiyoto-coming-soon.html`).
2. Near the bottom of the file in the `<script>` tag, find:
   ```javascript
   const WAITLIST_ENDPOINT = "";
   ```
3. Paste your Web App URL between the quotes:
   ```javascript
   const WAITLIST_ENDPOINT = "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec";
   ```
4. Save and deploy to Vercel (or git push).

---

## Setting Up Automatic Email Broadcasting

To enable the system to automatically send broadcasts whenever you email from `contactkiyoto@gmail.com`:

1. In the Apps Script editor, click the **Triggers** icon (the clock icon on the left sidebar).
2. Click **+ Add Trigger** (bottom right).
3. Configure the trigger:
   - **Choose which function to run**: `checkAndSendBroadcasts`
   - **Select event source**: `Time-driven`
   - **Select type of time based trigger**: `Minutes timer`
   - **Select minute interval**: `Every 5 minutes` (or `Every 10 minutes`)
4. Click **Save**.

### How to Broadcast an Email to All Subscribers
- In your `contactkiyoto@gmail.com` inbox, write an email.
- Set the subject as: `[KiYOTO Broadcast] The KiYOTO website is now live`
- Click **Send**.
- Within 5 minutes, the script will automatically BCC that email to all subscribers on your waitlist and label the thread as `KiYOTO-Broadcasted` so it is never sent twice!

---

## How Unsubscribing Works (3 Ways)

1. **Automatic 1-Click Link**:
   - Every email sent from the script includes a 1-click unsubscribe link in the footer.
   - When a subscriber clicks it, Google Apps Script sets their status to `Unsubscribed` in your Google Sheet immediately.
2. **Reply with "Unsubscribe"**:
   - The footer states: *"To unsubscribe, reply with 'Unsubscribe' or email contactkiyoto@gmail.com"*.
   - If anyone replies, you can remove them or update their status in the sheet.
3. **Manual Control in Google Sheets**:
   - Open your Google Sheet (`Subscribers` tab).
   - Find the subscriber's row.
   - In **Column C (`Status`)**, change `Active` to `Unsubscribed` (or delete the row).
   - The script automatically filters out anyone marked `Unsubscribed` from all future broadcasts.

