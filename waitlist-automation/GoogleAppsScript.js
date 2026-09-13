/**
 * KiYOTO Waitlist & Email Automation Script
 * Google Apps Script for contactkiyoto@gmail.com
 * 
 * Features:
 * 1. doPost(e): Webhook receiving waitlist submissions from the website and appending to Google Sheet.
 * 2. Automated Welcome: Instantly emails new subscribers from contactkiyoto@gmail.com.
 * 3. Automated Broadcast via Gmail: Periodically checks for emails sent or drafted with subject starting
 *    with "[KiYOTO Broadcast]" and delivers them to every person on the waitlist.
 * 4. Manual Broadcast Menu: Adds a custom menu directly in Google Sheets to send broadcasts with 1 click.
 */

const CONFIG = {
  SHEET_NAME: "Subscribers",
  SENDER_NAME: "KiYOTO",
  SENDER_EMAIL: "contactkiyoto@gmail.com",
  BROADCAST_PREFIX: "[KiYOTO Broadcast]", // Put this in the subject of an email sent from contactkiyoto@gmail.com to trigger broadcast
  PROCESSED_LABEL: "KiYOTO-Broadcasted",
  SEND_WELCOME_EMAIL: true,
  WELCOME_SUBJECT: "Welcome to the KiYOTO Waitlist",
  WELCOME_BODY_HTML: `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; color: #0a0a0a; line-height: 1.6;">
      <h2 style="font-size: 24px; font-weight: 600; letter-spacing: -0.02em; margin-bottom: 20px;">You are on the list.</h2>
      <p style="color: #444; font-size: 15px;">Thank you for joining the KiYOTO waitlist. We are crafting something special and will notify you the moment we launch or release new products.</p>
      <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #eaeaea; font-size: 13px; color: #888;">
        KiYOTO &mdash; <a href="https://x.com/madebykiyoto" style="color: #0a0a0a; text-decoration: none;">@madebykiyoto</a>
      </div>
    </div>
  `
};

/**
 * Handles incoming POST requests from the website form
 */
function doPost(e) {
  try {
    const lock = LockService.getScriptLock();
    lock.waitLock(10000); // Wait up to 10s for lock to prevent race conditions

    let email = "";
    let source = "website";

    if (e.postData && e.postData.contents) {
      try {
        const data = JSON.parse(e.postData.contents);
        email = (data.email || "").trim().toLowerCase();
        source = data.source || "website";
      } catch (err) {
        email = (e.parameter.email || "").trim().toLowerCase();
      }
    } else if (e.parameter) {
      email = (e.parameter.email || "").trim().toLowerCase();
    }

    if (!email || !isValidEmail(email)) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Invalid email address"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const sheet = getOrCreateSheet();
    const data = sheet.getDataRange().getValues();
    let existingRowIndex = -1;
    let existingStatus = "";

    for (let i = 1; i < data.length; i++) {
      const rowEmail = (data[i][0] || "").toString().trim().toLowerCase();
      if (rowEmail === email) {
        existingRowIndex = i + 1; // 1-indexed row number in Google Sheets
        existingStatus = (data[i][2] || "").toString().trim().toLowerCase();
        break;
      }
    }

    const timestamp = new Date();

    if (existingRowIndex > 0) {
      if (existingStatus === "active") {
        // Already actively subscribed
        lock.releaseLock();
        return ContentService.createTextOutput(JSON.stringify({
          status: "success",
          message: "Already subscribed",
          alreadySubscribed: true
        })).setMimeType(ContentService.MimeType.JSON);
      } else {
        // Was unsubscribed -> Re-activate their subscription!
        sheet.getRange(existingRowIndex, 2).setValue(timestamp);
        sheet.getRange(existingRowIndex, 3).setValue("Active");
        sheet.getRange(existingRowIndex, 4).setValue(source);
        Logger.log(`Subscriber re-activated: ${email}`);
      }
    } else {
      // Brand new subscriber
      sheet.appendRow([email, timestamp, "Active", source]);
      Logger.log(`New subscriber added: ${email}`);
    }

    // Send instant welcome email
    if (CONFIG.SEND_WELCOME_EMAIL) {
      try {
        let webAppUrl = "";
        try { webAppUrl = ScriptApp.getService().getUrl(); } catch (e) {}
        const unsubUrl = webAppUrl 
          ? `${webAppUrl}?action=unsubscribe&email=${encodeURIComponent(email)}` 
          : `mailto:${CONFIG.SENDER_EMAIL}?subject=Unsubscribe`;

        const welcomeHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; color: #0a0a0a; line-height: 1.6;">
            <h2 style="font-size: 24px; font-weight: 600; letter-spacing: -0.02em; margin-bottom: 20px;">You are on the list.</h2>
            <p style="color: #444; font-size: 15px;">Thank you for joining the KiYOTO waitlist. We are crafting something special and will notify you the moment we launch or release new products.</p>
            <div style="margin-top: 36px; padding-top: 20px; border-top: 1px solid #eaeaea; font-size: 12px; color: #888; line-height: 1.6;">
              KiYOTO &mdash; <a href="https://x.com/madebykiyoto" style="color: #0a0a0a; text-decoration: none;">@madebykiyoto</a><br>
              Subscription is optional and can be cancelled anytime.<br>
              To unsubscribe, <a href="${unsubUrl}" style="color: #666; text-decoration: underline;">click here to unsubscribe</a> or reply with &ldquo;Unsubscribe&rdquo;.
            </div>
          </div>
        `;

        GmailApp.sendEmail(email, CONFIG.WELCOME_SUBJECT, "You are on the KiYOTO waitlist. We will notify you when we release new updates.\n\nTo unsubscribe, reply with 'Unsubscribe' or email contactkiyoto@gmail.com.", {
          name: CONFIG.SENDER_NAME,
          htmlBody: welcomeHtml
        });
      } catch (emailErr) {
        Logger.log("Error sending welcome email: " + emailErr.message);
      }
    }

    lock.releaseLock();

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Subscribed successfully"
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handles browser GET requests:
 * 1. 1-Click Unsubscribe: ?action=unsubscribe&email=...
 * 2. Health check: displays API status
 */
function doGet(e) {
  if (e && e.parameter && (e.parameter.action === "unsubscribe" || e.parameter.unsubscribe)) {
    const emailToUnsub = (e.parameter.email || e.parameter.unsubscribe || "").trim().toLowerCase();
    if (emailToUnsub) {
      const sheet = getOrCreateSheet();
      const data = sheet.getDataRange().getValues();
      let found = false;
      for (let i = 1; i < data.length; i++) {
        if ((data[i][0] || "").toString().trim().toLowerCase() === emailToUnsub) {
          sheet.getRange(i + 1, 3).setValue("Unsubscribed");
          found = true;
        }
      }
      const heading = found ? "Unsubscribed" : "Notice";
      const message = found 
        ? `<strong>${emailToUnsub}</strong> has been successfully unsubscribed from the KiYOTO waitlist. You will not receive any further emails.` 
        : `Email (${emailToUnsub}) was not found or is already unsubscribed.`;

      return HtmlService.createHtmlOutput(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Unsubscribe &mdash; KiYOTO</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #fafaf8; color: #0a0a0a; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
            .card { background: #ffffff; padding: 40px 32px; border-radius: 20px; border: 1px solid rgba(10,10,10,0.08); max-width: 440px; text-align: center; box-shadow: 0 12px 36px rgba(0,0,0,0.04); }
            h1 { font-size: 20px; font-weight: 600; margin: 0 0 12px 0; letter-spacing: -0.01em; }
            p { color: rgba(10,10,10,0.65); font-size: 14px; line-height: 1.6; margin: 0 0 24px 0; }
            a { display: inline-block; padding: 8px 18px; background: #0a0a0a; color: #fafaf8; border-radius: 999px; text-decoration: none; font-size: 13px; font-weight: 500; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>${heading}</h1>
            <p>${message}</p>
            <a href="https://madebykiyoto.com">&larr; Return to KiYOTO</a>
          </div>
        </body>
        </html>
      `).setTitle("Unsubscribe — KiYOTO");
    }
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    message: "KiYOTO Waitlist Automation API is live."
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * AUTOMATED BROADCAST:
 * Run this function on an installable time-driven trigger (e.g. every 5 minutes).
 * When you send an email from contactkiyoto@gmail.com with "[KiYOTO Broadcast]" in the subject,
 * this function automatically picks it up and forwards it to all subscribers on the waitlist!
 */
function checkAndSendBroadcasts() {
  const query = `from:${CONFIG.SENDER_EMAIL} subject:"${CONFIG.BROADCAST_PREFIX}" -label:${CONFIG.PROCESSED_LABEL}`;
  const threads = GmailApp.search(query, 0, 5);

  if (threads.length === 0) {
    Logger.log("No new broadcasts found.");
    return;
  }

  const label = getOrCreateLabel(CONFIG.PROCESSED_LABEL);
  const sheet = getOrCreateSheet();
  const subscribers = getAllSubscribers(sheet);

  if (subscribers.length === 0) {
    Logger.log("No subscribers found on waitlist.");
    return;
  }

  for (const thread of threads) {
    const messages = thread.getMessages();
    const originalMessage = messages[messages.length - 1]; // Latest message in thread
    
    // Remove the prefix for subscribers
    const cleanSubject = originalMessage.getSubject().replace(CONFIG.BROADCAST_PREFIX, "").trim() || "KiYOTO Announcement";
    const bodyPlain = originalMessage.getPlainBody();
    const bodyHtml = originalMessage.getBody();

    Logger.log(`Broadcasting to ${subscribers.length} subscribers: "${cleanSubject}"`);

    const broadcastFooterHtml = `
      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eaeaea; font-size: 12px; color: #888; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5;">
        KiYOTO &mdash; <a href="https://x.com/madebykiyoto" style="color: #0a0a0a; text-decoration: none;">@madebykiyoto</a><br>
        You received this email because you are on the KiYOTO waitlist. Subscription is optional.<br>
        To unsubscribe, reply to this email with &ldquo;Unsubscribe&rdquo; or contact contactkiyoto@gmail.com.
      </div>
    `;
    const broadcastFooterPlain = `\n\n---\nKiYOTO — @madebykiyoto\nTo unsubscribe, reply with 'Unsubscribe' or email contactkiyoto@gmail.com.`;

    const finalHtml = bodyHtml + broadcastFooterHtml;
    const finalPlain = bodyPlain + broadcastFooterPlain;

    // Broadcast using BCC batches to respect Gmail rate limits
    const BATCH_SIZE = 50;
    for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
      const batch = subscribers.slice(i, i + BATCH_SIZE);
      GmailApp.sendEmail(CONFIG.SENDER_EMAIL, cleanSubject, finalPlain, {
        name: CONFIG.SENDER_NAME,
        bcc: batch.join(","),
        htmlBody: finalHtml
      });
      Utilities.sleep(1000); // 1s pause between batches
    }

    // Mark as processed so it doesn't resend
    thread.addLabel(label);
    Logger.log("Broadcast complete.");
  }
}

/**
 * Custom UI menu in Google Sheets
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("KiYOTO Waitlist")
    .addItem("Send Broadcast from Gmail Draft", "sendBroadcastFromDraftPrompt")
    .addItem("Refresh Subscriber Count", "showSubscriberCount")
    .addToUi();
}

/**
 * Lets the user pick a Gmail draft from a popup in Google Sheets and broadcast it to everyone
 */
function sendBroadcastFromDraftPrompt() {
  const ui = SpreadsheetApp.getUi();
  const drafts = GmailApp.getDrafts();

  if (drafts.length === 0) {
    ui.alert("No Gmail drafts found. Please create a draft in contactkiyoto@gmail.com first.");
    return;
  }

  let promptText = "Choose a draft number to broadcast to ALL subscribers:\\n\\n";
  const draftList = [];
  for (let i = 0; i < Math.min(drafts.length, 5); i++) {
    const subj = drafts[i].getMessage().getSubject() || "(No Subject)";
    draftList.push(drafts[i]);
    promptText += `${i + 1}. "${subj}"\\n`;
  }

  const response = ui.prompt("Send Broadcast to Waitlist", promptText + "\\nEnter draft number (1-" + draftList.length + "):", ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK) return;

  const choice = parseInt(response.getResponseText().trim(), 10);
  if (isNaN(choice) || choice < 1 || choice > draftList.length) {
    ui.alert("Invalid selection.");
    return;
  }

  const selectedDraft = draftList[choice - 1].getMessage();
  const subject = selectedDraft.getSubject();
  const subscribers = getAllSubscribers(getOrCreateSheet());

  const confirm = ui.alert("Confirm Broadcast", `Are you sure you want to send "${subject}" to ${subscribers.length} subscribers?`, ui.ButtonSet.YES_NO);
  if (confirm !== ui.Button.YES) return;

  const bodyPlain = selectedDraft.getPlainBody();
  const bodyHtml = selectedDraft.getBody();

  const broadcastFooterHtml = `
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eaeaea; font-size: 12px; color: #888; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5;">
      KiYOTO &mdash; <a href="https://x.com/madebykiyoto" style="color: #0a0a0a; text-decoration: none;">@madebykiyoto</a><br>
      You received this email because you are on the KiYOTO waitlist. Subscription is optional.<br>
      To unsubscribe, reply to this email with &ldquo;Unsubscribe&rdquo; or contact contactkiyoto@gmail.com.
    </div>
  `;
  const broadcastFooterPlain = `\n\n---\nKiYOTO — @madebykiyoto\nTo unsubscribe, reply with 'Unsubscribe' or email contactkiyoto@gmail.com.`;

  const finalHtml = bodyHtml + broadcastFooterHtml;
  const finalPlain = bodyPlain + broadcastFooterPlain;

  // Send in BCC batches
  const BATCH_SIZE = 50;
  for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
    const batch = subscribers.slice(i, i + BATCH_SIZE);
    GmailApp.sendEmail(CONFIG.SENDER_EMAIL, subject, finalPlain, {
      name: CONFIG.SENDER_NAME,
      bcc: batch.join(","),
      htmlBody: finalHtml
    });
    Utilities.sleep(1000);
  }

  ui.alert("Success", `Broadcast sent to ${subscribers.length} subscribers!`, ui.ButtonSet.OK);
}

function showSubscriberCount() {
  const ui = SpreadsheetApp.getUi();
  const count = getAllSubscribers(getOrCreateSheet()).length;
  ui.alert("KiYOTO Waitlist", `Total active subscribers: ${count}`, ui.ButtonSet.OK);
}

/* Helper functions */
function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    sheet.appendRow(["Email", "Joined Date", "Status", "Source"]);
    sheet.getRange(1, 1, 1, 4).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getAllSubscribers(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  const emails = [];
  for (let i = 1; i < data.length; i++) {
    const email = (data[i][0] || "").toString().trim().toLowerCase();
    const status = (data[i][2] || "").toString().trim().toLowerCase();
    if (email && isValidEmail(email) && status !== "unsubscribed") {
      emails.push(email);
    }
  }
  return emails;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getOrCreateLabel(name) {
  let label = GmailApp.getUserLabelByName(name);
  if (!label) {
    label = GmailApp.createLabel(name);
  }
  return label;
}
