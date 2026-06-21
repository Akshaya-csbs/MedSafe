import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { generateKeyPair, encryptRecord, generateHash } from "./src/utils/cryptoSim.js";
import { UserProfile, MedicalRecord, AccessRequest, AuditLog } from "./src/types.js";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// In-Memory Database
let users: UserProfile[] = [];
let records: MedicalRecord[] = [];
let requests: AccessRequest[] = [];
let logs: AuditLog[] = [];

// Seed Database
function seedDatabase() {
  const eleanorKeys = generateKeyPair("Eleanor Vance");
  const chenKeys = generateKeyPair("Dr. Robert Chen");
  const linKeys = generateKeyPair("Dr. Sarah Lin");

  const eleanor: UserProfile = {
    id: "eleanor-vance",
    email: "eleanor@vance.io",
    name: "Eleanor Vance",
    role: "PATIENT",
    publicKey: eleanorKeys.publicKey,
    privateKey: eleanorKeys.privateKey,
    createdAt: new Date().toISOString(),
    passcode: "password"
  };

  const chen: UserProfile = {
    id: "robert-chen",
    email: "chen@metrocardio.org",
    name: "Dr. Robert Chen",
    role: "DOCTOR",
    licenceNumber: "LIC-99321-CH",
    specialty: "Cardiology",
    publicKey: chenKeys.publicKey,
    privateKey: chenKeys.privateKey,
    createdAt: new Date().toISOString(),
    passcode: "password"
  };

  const lin: UserProfile = {
    id: "sarah-lin",
    email: "lin@neurohealth.com",
    name: "Dr. Sarah Lin",
    role: "DOCTOR",
    licenceNumber: "LIC-11295-LN",
    specialty: "Neurology",
    publicKey: linKeys.publicKey,
    privateKey: linKeys.privateKey,
    createdAt: new Date().toISOString(),
    passcode: "password"
  };

  users = [eleanor, chen, lin];

  // Pre-seeded records for Eleanor Vance
  const record1Plain = "Patient exhibits stable sinus rhythm; Lisinopril 20mg Qd prescribed for essential hypertension. Monitor BP weekly.";
  const record1: MedicalRecord = {
    id: "rec-lisinopril",
    patientId: "eleanor-vance",
    title: "Hypertension Heart Record & Lisinopril Therapy",
    category: "Prescription",
    doctorName: "Dr. Robert Chen",
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 days ago
    details: record1Plain,
    encryptedContent: encryptRecord(record1Plain, eleanorKeys.publicKey),
    medicines: ["Lisinopril 20mg"],
    hash: generateHash(record1Plain)
  };

  const record2Plain = "Basic metabolic panel check: Na+: 139, K+: 4.1, Cl-: 102, Creatinine: 0.85 mg/dL. All indices within physiological norms.";
  const record2: MedicalRecord = {
    id: "rec-bmp-panel",
    patientId: "eleanor-vance",
    title: "Basic Metabolic Panel (Lab Chemistry)",
    category: "Lab Report",
    doctorName: "Dr. Robert Chen",
    date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 10 days ago
    details: record2Plain,
    encryptedContent: encryptRecord(record2Plain, eleanorKeys.publicKey),
    medicines: [],
    hash: generateHash(record2Plain)
  };

  records = [record1, record2];

  // Pre-seeded pending requests
  const req1: AccessRequest = {
    id: "req-chen-cardio",
    patientId: "eleanor-vance",
    patientName: "Eleanor Vance",
    doctorId: "robert-chen",
    doctorName: "Dr. Robert Chen",
    doctorSpecialty: "Cardiology",
    requestedPurpose: "Bi-annual lipid monitoring and medication synchronization check.",
    status: "APPROVED",
    requestedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    decidedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    digitalSignature: generateHash("APPROVED-eleanor-vance-robert-chen")
  };

  const req2: AccessRequest = {
    id: "req-lin-neuro",
    patientId: "eleanor-vance",
    patientName: "Eleanor Vance",
    doctorId: "sarah-lin",
    doctorName: "Dr. Sarah Lin",
    doctorSpecialty: "Neurology",
    requestedPurpose: "Diagnostic overview of episodic tension cephalalgia to rule out central pathology.",
    status: "PENDING",
    requestedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  };

  requests = [req1, req2];

  // Seed default audit logs
  logs = [
    {
      id: "log-seed-1",
      timestamp: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      action: "Primacy Ledger App Initialized",
      actorName: "Primacy Ledger",
      actorRole: "PATIENT",
      status: "SUCCESS",
      hash: generateHash("Ledger Initialized"),
      details: "Primacy medical database and validator nodes mounted successfully."
    }
  ];
}

seedDatabase();

interface OTPStoreVal {
  otp: string;
  expiresAt: number;
}
const otpStore = new Map<string, OTPStoreVal>();

// Helper to send email OTP
async function send_email_otp(email: string) {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes from now
  otpStore.set(email.toLowerCase(), { otp, expiresAt });

  const smtpServer = process.env.SMTP_SERVER || "smtp.gmail.com";
  const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const senderEmail = process.env.EMAIL || process.env.SENDER_EMAIL || "medsafeotp@gmail.com";
  const appPassword = process.env.APP_PASSWORD;

  if (!appPassword || appPassword === "MY_APP_PASSWORD" || appPassword.includes("xxxx")) {
    console.log(`\n==================================================`);
    console.log(`[OTP SIMULATOR] Generated OTP for ${email}: ${otp}`);
    console.log(`==================================================\n`);
    return { success: true, message: "OTP sent successfully (simulated)", simulated: true, otp };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpServer,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: senderEmail,
        pass: appPassword,
      },
    });

    const mailOptions = {
      from: `"MedSafe Secure Vault" <${senderEmail}>`,
      to: email,
      subject: "Your MedSafe Secure OTP Verification Code",
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e7; border-radius: 12px; background-color: #fafafa;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #0f766e; margin: 0;">MedSafe</h2>
            <p style="color: #71717a; font-size: 12px; margin-top: 5px;">Primacy Patient Medical Ledger</p>
          </div>
          <div style="background-color: #ffffff; padding: 24px; border-radius: 8px; border: 1px solid #e4e4e7; text-align: center;">
            <p style="color: #27272a; font-size: 14px; text-align: left; margin-top: 0;">Hello,</p>
            <p style="color: #27272a; font-size: 14px; text-align: left;">Use the verification code below to authorize your session or finalise key pair registration. This code is valid for 10 minutes.</p>
            <div style="margin: 24px 0; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0f766e; font-family: monospace;">${otp}</div>
            <p style="color: #71717a; font-size: 11px; margin-bottom: 0;">If you did not request this code, please ignore this email.</p>
          </div>
          <div style="text-align: center; margin-top: 20px; color: #a1a1aa; font-size: 10px;">
            &copy; 2026 MedSafe Ledger. All rights reserved.
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`[OTP] Sent real email OTP to ${email}`);
    return { success: true, message: "OTP sent successfully", simulated: false };
  } catch (err: any) {
    console.error("Failed to send OTP email via nodemailer:", err);
    console.log(`\n==================================================`);
    console.log(`[OTP FALLBACK] Generated OTP for ${email}: ${otp}`);
    console.log(`==================================================\n`);
    return { success: true, message: "OTP sent successfully (simulated fallback)", simulated: true, otp, error: err.message };
  }
}

// Helper to verify email OTP
function verify_email_otp(email: string, otp: string): [boolean, string] {
  const record = otpStore.get(email.toLowerCase());
  if (!record) {
    return [false, "No OTP requested or OTP has expired."];
  }
  if (Date.now() > record.expiresAt) {
    otpStore.delete(email.toLowerCase());
    return [false, "OTP has expired. Please request a new one."];
  }
  if (record.otp !== otp) {
    return [false, "Invalid OTP code. Please check and try again."];
  }
  otpStore.delete(email.toLowerCase());
  return [true, "OTP verified successfully"];
}

// --- API Endpoints ---

// POST /api/otp/send
app.post("/api/otp/send", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email parameter is required" });
  }
  const result = await send_email_otp(email);
  return res.json(result);
});

// POST /api/otp/verify
app.post("/api/otp/verify", (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: "Email and OTP parameters are required" });
  }
  const [success, msg] = verify_email_otp(email, otp);
  if (!success) {
    return res.status(400).json({ error: msg });
  }
  return res.json({ status: "success", message: msg });
});

// Get current state
app.get("/api/state", (req, res) => {
  res.json({ users, records, requests, logs });
});

// Register User
app.post("/api/users/register", (req, res) => {
  const newUser: UserProfile = req.body;
  if (!newUser || !newUser.id || !newUser.email) {
    return res.status(400).json({ error: "Invalid user data" });
  }
  // Check if exists
  if (users.some(u => u.email.toLowerCase() === newUser.email.toLowerCase() && u.role === newUser.role)) {
    return res.status(400).json({ error: "User already exists on ledger" });
  }
  users.push(newUser);
  res.json({ success: true, user: newUser });
});

// Add Medical Record
app.post("/api/records", (req, res) => {
  const newRec: MedicalRecord = req.body;
  if (!newRec || !newRec.id || !newRec.patientId) {
    return res.status(400).json({ error: "Invalid medical record data" });
  }
  records.unshift(newRec);
  res.json({ success: true, record: newRec });
});

// Submit Access Request (by doctor)
app.post("/api/requests/submit", (req, res) => {
  const newRequest: AccessRequest = req.body;
  if (!newRequest || !newRequest.id || !newRequest.patientId) {
    return res.status(400).json({ error: "Invalid request parameters" });
  }
  requests.unshift(newRequest);
  res.json({ success: true, request: newRequest });
});

// Update Access Request Status (approve, reject, revoke)
app.post("/api/requests/update", (req, res) => {
  const { requestId, status, digitalSignature } = req.body;
  if (!requestId || !status) {
    return res.status(400).json({ error: "Missing parameters" });
  }
  let updated = false;
  requests = requests.map(req => {
    if (req.id === requestId) {
      updated = true;
      return {
        ...req,
        status,
        decidedAt: new Date().toISOString(),
        ...(digitalSignature ? { digitalSignature } : {})
      };
    }
    return req;
  });
  if (!updated) {
    return res.status(404).json({ error: "Request not found" });
  }
  res.json({ success: true });
});

// Log audit activities
app.post("/api/logs", (req, res) => {
  const newLog: AuditLog = req.body;
  if (!newLog || !newLog.id) {
    return res.status(400).json({ error: "Invalid log entry" });
  }
  logs.unshift(newLog);
  res.json({ success: true });
});

// Reset State
app.post("/api/reset", (req, res) => {
  seedDatabase();
  res.json({ success: true, message: "Database re-seeded successfully" });
});

// Vite & Static Asset Handling
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
