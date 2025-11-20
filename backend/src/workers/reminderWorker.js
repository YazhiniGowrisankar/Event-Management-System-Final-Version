const nodeCron = require("node-cron");
const Reminder = require("../models/Reminder");
const { sendEmail } = require("../services/email");
const Event = require("../models/Event");

const formatReminderDate = (value) => {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
};

const buildReminderHtml = (event) => `
  <table width="100%" cellpadding="0" cellspacing="0" style="font-family:'Segoe UI',Arial,sans-serif;background:#f4f6fb;padding:24px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 15px 45px rgba(15,23,42,0.15);">
          <tr>
            <td style="padding:28px;background:linear-gradient(120deg,#0ea5e9,#6366f1);color:#fff;">
              <h2 style="margin:0;font-size:22px;">Heads up! Your event is coming up</h2>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <h3 style="margin-top:0;margin-bottom:8px;color:#0f172a;">${event?.title || "Upcoming Event"}</h3>
              <p style="margin:0 0 16px;color:#475569;line-height:1.6;">
                Just a friendly reminder so you never miss a moment.
              </p>
              <div style="padding:16px;background:#f1f5f9;border-radius:16px;margin-bottom:24px;">
                <p style="margin:0;color:#0f172a;font-weight:600;">Date & Time</p>
                <p style="margin:4px 0 0;color:#475569;">${formatReminderDate(event?.startAt)}</p>
                ${event?.location ? `<p style="margin:16px 0 0;color:#0f172a;font-weight:600;">Location</p><p style="margin:4px 0 0;color:#475569;">${event.location}</p>` : ""}
              </div>
              <p style="margin:0;color:#94a3b8;font-size:13px;">Need to make changes? Open your dashboard and update your RSVP anytime.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
`;

// Runs every minute, sends due reminders
function startReminderWorker() {
  nodeCron.schedule("* * * * *", async () => {
    const now = new Date();
    const due = await Reminder.find({ status: "scheduled", sendAt: { $lte: now } }).limit(50);
    for (const r of due) {
      try {
        const event = await Event.findById(r.event);
        await sendEmail({
          to: r.recipient,
          subject: `Reminder: ${event?.title || "Event"}`,
          html: buildReminderHtml(event),
        });
        r.status = "sent";
        await r.save();
      } catch (e) {
        r.status = "failed";
        r.error = e.message;
        await r.save();
      }
    }
  });
}

module.exports = { startReminderWorker };






