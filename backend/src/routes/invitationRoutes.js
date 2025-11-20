const express = require("express");
const jwt = require("jsonwebtoken");
const { randomUUID } = require("crypto");
const Invitation = require("../models/Invitation");
const Event = require("../models/Event");
const { sendEmail } = require("../services/email");

const router = express.Router();

const formatEventDate = (value) => {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
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

const buildInvitationHtml = (event, link) => `
  <table width="100%" cellpadding="0" cellspacing="0" style="font-family:'Segoe UI',Arial,sans-serif;background:#f4f6fb;padding:24px;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 20px 60px rgba(80,72,229,0.15);">
          <tr>
            <td style="padding:36px;background:linear-gradient(135deg,#6d28d9,#7c3aed,#a855f7);color:#fff;">
              <h1 style="margin:0;font-size:28px;">You’re invited!</h1>
              <p style="margin:12px 0 0;font-size:16px;opacity:0.85;">${event.title}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="font-size:16px;color:#0f172a;margin-top:0;">Hello!</p>
              <p style="font-size:15px;color:#475569;line-height:1.7;">
                ${event.createdBy?.name ? `${event.createdBy.name} has` : "An organizer has"} invited you to join <strong>${event.title}</strong>.
                We’d love to see you there—here are the essentials:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border-collapse:separate;border-spacing:0 12px;">
                <tr>
                  <td style="padding:16px;background:#f1f5f9;border-radius:16px;">
                    <strong style="display:block;color:#0f172a;">When</strong>
                    <span style="color:#475569;">${formatEventDate(event.startAt) || "To be announced"}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px;background:#f1f5f9;border-radius:16px;">
                    <strong style="display:block;color:#0f172a;">Where</strong>
                    <span style="color:#475569;">${event.location || "Venue details will be shared soon"}</span>
                  </td>
                </tr>
                ${event.description ? `
                  <tr>
                    <td style="padding:16px;background:#f8fafc;border-radius:16px;">
                      <strong style="display:block;color:#0f172a;">Why you’ll love it</strong>
                      <span style="color:#475569;">${event.description}</span>
                    </td>
                  </tr>` : ""}
              </table>

              <p style="text-align:center;margin:36px 0;">
                <a href="${link}" style="display:inline-block;padding:14px 30px;background:#6d28d9;color:#fff;border-radius:999px;text-decoration:none;font-weight:600;">
                  View invitation & RSVP
                </a>
              </p>

              <p style="font-size:13px;color:#94a3b8;line-height:1.6;">
                Need more details? Just hit reply to this email. We hope you can make it!
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
`;

const authMiddleware = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token, authorization denied" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.id;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

// Create and send invitations (basic create; email sending handled elsewhere)
router.post("/:eventId", authMiddleware, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { emails } = req.body; // array of emails

    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: "emails array is required" });
    }

    const event = await Event.findOne({ _id: eventId, createdBy: req.user }).populate("createdBy", "name email");
    if (!event) return res.status(404).json({ error: "Event not found or not authorized" });

    const invitations = await Promise.all(emails.map(async (email) => {
      const token = randomUUID();
      const inv = await Invitation.create({ event: eventId, email, token, sentAt: new Date() });
      const baseUrl = process.env.PUBLIC_WEB_URL || "http://localhost:3000";
      const link = `${baseUrl}/invite/${token}`;
      try {
        await sendEmail({
          to: email,
          subject: `Invitation: ${event.title}`,
          html: buildInvitationHtml(event, link),
        });
      } catch (e) {
        console.error("Failed to send invite email", e.message);
      }
      return inv;
    }));

    res.json({ msg: "Invitations created", invitations });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// List invitations for an event (organizer only)
router.get("/:eventId", authMiddleware, async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findOne({ _id: eventId, createdBy: req.user });
    if (!event) return res.status(404).json({ error: "Event not found or not authorized" });
    const invitations = await Invitation.find({ event: eventId });
    res.json(invitations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Respond to invitation via token
router.post("/respond/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { action } = req.body; // "accept" | "decline"
    const invitation = await Invitation.findOne({ token });
    if (!invitation) return res.status(404).json({ error: "Invitation not found" });
    if (!["accept", "decline"].includes(action)) {
      return res.status(400).json({ error: "Invalid action" });
    }
    invitation.status = action === "accept" ? "accepted" : "declined";
    invitation.respondedAt = new Date();
    await invitation.save();
    res.json({ msg: "Response recorded", invitation });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;


