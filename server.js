// Career form mailer — nodemailer SMTP (fully server-side, no EmailJS)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors    = require('cors');
const multer  = require('multer');
const nodemailer = require('nodemailer');

// SMTP transporter (configured via .env)
const transporter = nodemailer.createTransport({
	host:   process.env.SMTP_HOST || 'smtp.gmail.com',
	port:   parseInt(process.env.SMTP_PORT || '587', 10),
	secure: process.env.SMTP_SECURE === 'true',  // true for 465, false for 587
	auth: {
		user: process.env.SMTP_USER,
		pass: process.env.SMTP_PASS,
	},
	family: 4,  // Force IPv4 to avoid IPv6 connectivity issues
});

const app = express();

// Allow comma-separated origins via ALLOWED_ORIGINS; defaults to '*'.
// Also allows requests with origin 'null' (file:// or direct open).
const allowedOrigins = process.env.ALLOWED_ORIGINS
	? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
	: null;

app.use(cors({
	origin: (origin, callback) => {
		// Allow curl/Postman (no origin) and file:// (null origin)
		if (!origin || origin === 'null') return callback(null, true);
		if (!allowedOrigins || allowedOrigins.includes(origin)) return callback(null, true);
		return callback(new Error(`CORS: origin '${origin}' not allowed`));
	},
	credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --------------- FILE UPLOAD ---------------
const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE_BYTES || '5242880', 10) },
	fileFilter: (_req, file, cb) => {
		const allowed = [
			'application/pdf',
			'application/msword',
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		];
		if (allowed.includes(file.mimetype)) return cb(null, true);
		cb(new Error('Only PDF and Word documents are allowed'));
	},
});

// --------------- ROUTES ---------------
app.get('/health', (_req, res) => {
	res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/career', upload.single('resume'), async (req, res) => {
	const { name, email, mobile, job_title, experience, current_ctc, expected_ctc } = req.body;

	// Validate all required fields
	const missing = [];
	if (!name)         missing.push('name');
	if (!email)        missing.push('email');
	if (!mobile)       missing.push('mobile');
	if (!job_title)    missing.push('job_title');
	if (!experience)   missing.push('experience');
	if (!current_ctc)  missing.push('current_ctc');
	if (!expected_ctc) missing.push('expected_ctc');
	if (!req.file)     missing.push('resume');

	if (missing.length) {
		return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
	}

	const to = (process.env.HR_INBOX || 'harikumarph123@gmail.com').trim();
	const skills = req.body.skills || 'Not provided';

	console.log(`[Mailer] Sending application from '${name}' → ${to}`);

	try {
		await transporter.sendMail({
			from:    `"Asionix Careers" <${process.env.SMTP_USER}>`,
			to,
			subject: `New Job Application: ${job_title} — ${name}`,
			html: `
				<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;border:1px solid #e0e0e0;border-radius:10px;overflow:hidden">
					<div style="background:linear-gradient(135deg,#0d2137,#1a3a5c);padding:24px;color:#fff">
						<h2 style="margin:0">New Job Application</h2>
						<p style="margin:6px 0 0;opacity:.85">${job_title}</p>
					</div>
					<div style="padding:24px">
						<table style="width:100%;border-collapse:collapse;font-size:14px">
							<tr><td style="padding:8px 0;color:#666;width:160px">Name</td><td style="font-weight:600">${name}</td></tr>
							<tr><td style="padding:8px 0;color:#666">Email</td><td style="font-weight:600">${email}</td></tr>
							<tr><td style="padding:8px 0;color:#666">Mobile</td><td style="font-weight:600">${mobile}</td></tr>
							<tr><td style="padding:8px 0;color:#666">Job Title</td><td style="font-weight:600">${job_title}</td></tr>
							<tr><td style="padding:8px 0;color:#666">Skills</td><td style="font-weight:600">${skills}</td></tr>
							<tr><td style="padding:8px 0;color:#666">Experience</td><td style="font-weight:600">${experience}</td></tr>
							<tr><td style="padding:8px 0;color:#666">Current CTC</td><td style="font-weight:600">${current_ctc}</td></tr>
							<tr><td style="padding:8px 0;color:#666">Expected CTC</td><td style="font-weight:600">${expected_ctc}</td></tr>
						</table>
						<p style="margin:24px 0 0;color:#666;font-size:13px">Resume is attached to this email.</p>
					</div>
				</div>`,
			attachments: [{
				filename:    req.file.originalname,
				content:     req.file.buffer,
				contentType: req.file.mimetype,
			}],
		});

		console.log('[Mailer] Email sent successfully');
		return res.json({ success: true, message: 'Application submitted successfully.' });
	} catch (err) {
		console.error('[Mailer] Failed to send:', err.message);
		return res.status(500).json({ error: `Failed to send email: ${err.message}` });
	}
});

// --------------- CONTACT FORM ---------------
app.post('/api/contact', async (req, res) => {
	const { firstName, lastName, email, phone, service, message } = req.body;

	const missing = [];
	if (!firstName) missing.push('firstName');
	if (!lastName)  missing.push('lastName');
	if (!email)     missing.push('email');
	if (!message)   missing.push('message');

	if (missing.length) {
		return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
	}

	const to = (process.env.HR_INBOX || 'harikumarph123@gmail.com').trim();
	const fullName = `${firstName} ${lastName}`;

	console.log(`[Contact] Inquiry from '${fullName}' <${email}>`);

	try {
		await transporter.sendMail({
			from:    `"Asionix Website" <${process.env.SMTP_USER}>`,
			to,
			replyTo: email,
			subject: `New Inquiry from ${fullName}`,
			html: `
				<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;border:1px solid #e0e0e0;border-radius:10px;overflow:hidden">
					<div style="background:linear-gradient(135deg,#0d2137,#1a3a5c);padding:24px;color:#fff">
						<h2 style="margin:0">New Contact Inquiry</h2>
						<p style="margin:6px 0 0;opacity:.85">From Website Contact Form</p>
					</div>
					<div style="padding:24px">
						<table style="width:100%;border-collapse:collapse;font-size:14px">
							<tr><td style="padding:8px 0;color:#666;width:140px">Name</td><td style="font-weight:600">${fullName}</td></tr>
							<tr><td style="padding:8px 0;color:#666">Email</td><td style="font-weight:600"><a href="mailto:${email}">${email}</a></td></tr>
							<tr><td style="padding:8px 0;color:#666">Phone</td><td style="font-weight:600">${phone || 'Not provided'}</td></tr>
							<tr><td style="padding:8px 0;color:#666">Service</td><td style="font-weight:600">${service || 'Not specified'}</td></tr>
						</table>
						<div style="margin-top:24px;padding:16px;background:#f9f9f9;border-radius:8px">
							<p style="margin:0 0 8px;color:#666;font-size:13px">Message:</p>
							<p style="margin:0;white-space:pre-wrap">${message}</p>
						</div>
					</div>
				</div>`,
		});

		console.log('[Contact] Email sent successfully');
		return res.json({ success: true, message: 'Message sent successfully.' });
	} catch (err) {
		console.error('[Contact] Failed to send:', err.message);
		return res.status(500).json({ error: `Failed to send email: ${err.message}` });
	}
});

// --------------- START ---------------
const PORT = parseInt(process.env.PORT || '3001', 10);
app.listen(PORT, () => console.log(`Career mailer listening on http://localhost:${PORT}`));
