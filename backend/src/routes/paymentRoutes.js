const express = require("express");
const jwt = require("jsonwebtoken");
const Payment = require("../models/Payment");
const Event = require("../models/Event");
const User = require("../models/User");
const { sendEmail } = require("../services/email");

const router = express.Router();

const TRANSACTION_PATTERNS = {
  GPay: /^GPA\.[A-Z0-9]{10,}$/i,
  PhonePe: /^PPE[A-Z0-9]{10,}$/i,
  Paytm: /^PTM[A-Z0-9]{10,}$/i,
  Card: /^[A-Z0-9]{12,}$/i,
  default: /^[A-Za-z0-9][A-Za-z0-9._-]{7,31}$/,
};

const normalizeTransactionId = (transactionId = "") =>
  transactionId.trim().toUpperCase();

const isTransactionIdValid = (method, transactionId) => {
  if (!transactionId) return false;
  const pattern = TRANSACTION_PATTERNS[method] || TRANSACTION_PATTERNS.default;
  return pattern.test(transactionId);
};

const formatDateForEmail = (value) => {
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

const sendPaymentSuccessEmail = async ({ user, event, paymentMethod, transactionId }) => {
  if (!user?.email) return;
  const baseUrl = process.env.PUBLIC_WEB_URL || "http://localhost:3000";
  const dashboardLink = `${baseUrl}/dashboard`;

  const html = `
    <table width="100%" cellpadding="0" cellspacing="0" style="font-family: 'Segoe UI', Arial, sans-serif; background:#f8fafc; padding:24px;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 15px 45px rgba(15,23,42,0.12);">
            <tr>
              <td style="padding:32px;background:linear-gradient(135deg,#6d28d9,#9333ea,#a855f7);color:#ffffff;">
                <h1 style="margin:0;font-size:26px;">Payment Confirmed 🎉</h1>
                <p style="margin:8px 0 0;font-size:15px;opacity:0.85;">You're officially registered for <strong>${event.title}</strong></p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="font-size:15px;color:#0f172a;">Hi ${user.name || "there"},</p>
                <p style="font-size:15px;color:#334155;line-height:1.7;">
                  We've successfully received your payment and saved your spot for <strong>${event.title}</strong>.
                  Here are the important details you might want to keep handy:
                </p>
                <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border-collapse:separate;border-spacing:0 12px;">
                  <tr>
                    <td style="padding:16px;border-radius:12px;background:#f1f5f9;">
                      <strong style="display:block;color:#0f172a;">Event</strong>
                      <span style="color:#475569;">${event.title}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:16px;border-radius:12px;background:#f1f5f9;">
                      <strong style="display:block;color:#0f172a;">Date & Time</strong>
                      <span style="color:#475569;">${formatDateForEmail(event.startAt)}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:16px;border-radius:12px;background:#f1f5f9;">
                      <strong style="display:block;color:#0f172a;">Location</strong>
                      <span style="color:#475569;">${event.location || "Venue details will be shared soon"}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:16px;border-radius:12px;background:#f1f5f9;">
                      <strong style="display:block;color:#0f172a;">Payment Method</strong>
                      <span style="color:#475569;">${paymentMethod}</span>
                    </td>
                  </tr>
                  ${transactionId ? `
                  <tr>
                    <td style="padding:16px;border-radius:12px;background:#f1f5f9;">
                      <strong style="display:block;color:#0f172a;">Transaction ID</strong>
                      <span style="color:#475569;">${transactionId}</span>
                    </td>
                  </tr>
                  ` : ''}
                </table>
                <p style="font-size:14px;color:#94a3b8;">Need to review your registration or download your ticket later? Visit your dashboard anytime.</p>
                <p style="text-align:center;margin:32px 0;">
                  <a href="${dashboardLink}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:#6d28d9;color:#ffffff;text-decoration:none;font-weight:600;">Open My Dashboard</a>
                </p>
                <p style="font-size:14px;color:#94a3b8;line-height:1.6;">If you didn't authorize this payment, please contact our support team immediately.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  try {
    await sendEmail({
      to: user.email,
      subject: `You're in! ${event.title} registration confirmed`,
      html,
    });
  } catch (error) {
    console.error("Failed to send payment confirmation email:", error.message);
  }
};

// Middleware to verify JWT
const authMiddleware = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token, authorization denied" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.id;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
};

// Simple payment registration endpoint
router.post("/register-paid-event/:eventId", authMiddleware, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user;
    const { paymentMethod, contactInfo, transactionId } = req.body;

    // Get event details
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Check if event is paid
    if (!event.isPaid || event.price === 0) {
      return res.status(400).json({ error: "This event is free. Use regular registration." });
    }

    // Check if event is in the past
    if (new Date(event.startAt) < new Date()) {
      return res.status(400).json({ error: "Cannot register for past events" });
    }

    // Check if user already registered
    if (event.registeredUsers.includes(userId)) {
      return res.status(400).json({ error: "Already registered for this event" });
    }

    // Check if event is full
    if (event.maxAttendees && event.registeredUsers.length >= event.maxAttendees) {
      return res.status(400).json({ error: "Event is full" });
    }

    // Check if payment already exists
    const existingPayment = await Payment.findOne({ 
      eventId, 
      userId, 
      paymentStatus: "completed" 
    });
    
    if (existingPayment) {
      return res.status(400).json({ error: "Payment already completed for this event" });
    }

    // Validate payment method
    const validMethods = ["GPay", "PhonePe", "Paytm", "Card", "Cash"];
    if (!paymentMethod || !validMethods.includes(paymentMethod)) {
      return res.status(400).json({ error: "Invalid payment method. Choose: GPay, PhonePe, Paytm, Card, or Cash" });
    }

    // Validate contact info
    if (!contactInfo || !contactInfo.fullName || !contactInfo.email || !contactInfo.phone) {
      return res.status(400).json({ error: "Please provide complete contact information" });
    }

    // Determine payment status based on method
    const paymentStatus = paymentMethod === "Cash" ? "pending" : "completed";

    let finalTransactionId = null;

    // For digital payments, validate transaction ID
    if (paymentMethod !== "Cash") {
      if (!transactionId) {
        return res.status(400).json({ error: `Transaction ID is required for ${paymentMethod} payments` });
      }

      finalTransactionId = normalizeTransactionId(transactionId);

      if (!isTransactionIdValid(paymentMethod, finalTransactionId)) {
        return res.status(400).json({ 
          error: `Invalid transaction ID format for ${paymentMethod}. Please check and try again.` 
        });
      }

      // Check for duplicate transaction
      const duplicateTransaction = await Payment.findOne({ transactionId: finalTransactionId });
      if (duplicateTransaction) {
        return res.status(400).json({ error: "This transaction ID has already been used. Please verify and try again." });
      }
    } else {
      // For cash payments, generate a pending transaction ID
      finalTransactionId = `CASH_${Date.now()}_${userId}`;
    }
    
    // Create payment record
    const payment = new Payment({
      eventId,
      userId,
      amount: event.price,
      currency: event.currency || "INR",
      paymentMethod,
      paymentStatus,
      transactionId: finalTransactionId,
      paymentDate: paymentStatus === "completed" ? new Date() : null,
      contactInfo
    });

    await payment.save();

    // Add user to event's registered users
    event.registeredUsers.push(userId);
    await event.save();

    // Get user details for email
    const user = await User.findById(userId);

    // Send confirmation email for completed payments
    if (paymentStatus === "completed" && user) {
      await sendPaymentSuccessEmail({ 
        user, 
        event, 
        paymentMethod, 
        transactionId: finalTransactionId 
      });
    }

    const responseMessage = paymentStatus === "completed"
      ? `Payment completed successfully via ${paymentMethod}! Registration confirmed.`
      : "Cash payment recorded. Registration will be confirmed after payment is received at the event.";

    res.json({ 
      msg: responseMessage,
      payment,
      event 
    });
  } catch (error) {
    console.error("Payment error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get user's payment history
router.get("/my-payments", authMiddleware, async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.user })
      .populate("eventId", "title startAt endAt location")
      .sort({ createdAt: -1 });
    
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get payment details for an event (admin/organizer only)
router.get("/event/:eventId", authMiddleware, async (req, res) => {
  try {
    const { eventId } = req.params;
    
    // Check if user is event organizer or admin
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    const token = req.headers["authorization"]?.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (event.createdBy.toString() !== req.user && decoded.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const payments = await Payment.find({ eventId })
      .populate("userId", "name email")
      .sort({ createdAt: -1 });
    
    const stats = {
      total: payments.length,
      completed: payments.filter(p => p.paymentStatus === "completed").length,
      pending: payments.filter(p => p.paymentStatus === "pending").length,
      failed: payments.filter(p => p.paymentStatus === "failed").length,
      totalRevenue: payments
        .filter(p => p.paymentStatus === "completed")
        .reduce((sum, p) => sum + p.amount, 0),
    };

    res.json({ payments, stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check if user has paid for an event
router.get("/check/:eventId", authMiddleware, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user;

    const payment = await Payment.findOne({ 
      eventId, 
      userId, 
      paymentStatus: "completed" 
    });

    res.json({ 
      hasPaid: !!payment,
      payment: payment || null 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update payment status (for Cash payments or admin updates)
router.patch("/update-status/:paymentId", authMiddleware, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { paymentStatus, transactionId } = req.body;
    const userId = req.user;

    // Find payment record
    const payment = await Payment.findById(paymentId).populate("eventId");
    if (!payment) {
      return res.status(404).json({ error: "Payment record not found" });
    }

    // Check authorization (user owns payment OR user is event organizer/admin)
    const token = req.headers["authorization"]?.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const isOwner = payment.userId.toString() === userId;
    const isOrganizer = payment.eventId.createdBy.toString() === userId;
    const isAdmin = decoded.role === "admin";

    if (!isOwner && !isOrganizer && !isAdmin) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Update payment status
    if (paymentStatus) {
      payment.paymentStatus = paymentStatus;
      if (paymentStatus === "completed" && !payment.paymentDate) {
        payment.paymentDate = new Date();
      }
    }

    if (transactionId) {
      payment.transactionId = transactionId;
    }

    await payment.save();

    res.json({ 
      msg: "Payment status updated successfully!",
      payment
    });
  } catch (error) {
    console.error("Update payment error:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
