require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const ChatbotService = require('./services/chatbotService');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:5173", "http://localhost:5174"],
    methods: ["GET", "POST"]
  }
});

app.use(cors());
// Increase payload limit for base64 images
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve static files from uploads directory with fallback
app.use('/uploads', express.static(uploadsDir));

// Middleware to handle missing files with placeholder
app.use('/uploads', (req, res, next) => {
  const filePath = path.join(uploadsDir, req.path);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️ File not found: ${filePath}`);
    
    // Return a placeholder response for missing images
    res.status(404).json({
      error: 'File not found',
      message: 'Tài liệu không tồn tại hoặc đã bị xóa',
      path: req.path
    });
    return;
  }
  
  next();
});

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { fileType } = req.body;
    let subDir = 'general';
    
    switch (fileType) {
      case 'avatar':
        subDir = 'avatars';
        break;
      case 'id_card_front':
      case 'id_card_back':
        subDir = 'id_cards';
        break;
      case 'profile_image':
        subDir = 'profiles';
        break;
      default:
        subDir = 'general';
    }
    
    const fullPath = path.join(uploadsDir, subDir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
    
    cb(null, fullPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${extension}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Allow images only
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ chấp nhận file hình ảnh (JPG, PNG, GIF)'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

/** Cột file_uploads.fileType là ENUM cố định; map mọi giá trị khác → document */
function normalizeFileUploadType(fileType) {
  const allowed = new Set(['avatar', 'id_card_front', 'id_card_back', 'profile_image', 'document']);
  const t = fileType != null ? String(fileType) : '';
  if (allowed.has(t)) return t;
  return 'document';
}

// Kết nối MySQL (Docker Compose: DB_HOST=mysql; chạy local: localhost trong backend/.env)
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
  database: process.env.DB_NAME || 'househelp',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306
});

db.connect(err => {
  if (err) throw err;
  console.log('MySQL Connected!');
  ensurePaymentSettlementColumns();
  ensureVerificationAiColumns();
  ensureVerificationDocumentColumns();
});

const JWT_SECRET = process.env.JWT_SECRET || 'househelp_dev_secret_change_me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');

const publicFileUrl = (filePath) => `${PUBLIC_BASE_URL}${filePath}`;
const PLATFORM_PAYMENT_ACCOUNT = process.env.PLATFORM_MOMO_ACCOUNT || 'HouseHelp Platform MoMo';
const PLATFORM_SERVICE_FEE = Number(process.env.PLATFORM_SERVICE_FEE || 50000);
const FPT_AI_API_KEY = process.env.FPT_AI_API_KEY || '';
const FPT_ID_RECOGNITION_ENDPOINT = process.env.FPT_ID_RECOGNITION_ENDPOINT || 'https://api.fpt.ai/vision/idr/vnm/';
const FPT_FACE_MATCH_ENDPOINT = process.env.FPT_FACE_MATCH_ENDPOINT || 'https://api.fpt.ai/dmp/checkface/v1';
const FPT_FACE_MATCH_PASS_SCORE = Number(process.env.FPT_FACE_MATCH_PASS_SCORE || 80);
const FPT_AI_TIMEOUT_MS = Number(process.env.FPT_AI_TIMEOUT_MS || 30000);

function serviceSearchTerms(serviceName) {
  const value = String(serviceName || '').trim();
  const terms = new Set([value]);
  const aliases = {
    'D\u1ecdn d\u1eb9p nh\u00e0 c\u1eeda': ['D\u1ecdn d\u1eb9p', 'd\u1ecdn d\u1eb9p', 'don dep', 'Don dep'],
    'V\u1ec7 sinh c\u00f4ng nghi\u1ec7p': ['V\u1ec7 sinh', 'v\u1ec7 sinh'],
    'Gi\u1eb7t \u1ee7i qu\u1ea7n \u00e1o': ['Gi\u1eb7t \u1ee7i', 'gi\u1eb7t \u1ee7i'],
  };

  (aliases[value] || []).forEach((term) => terms.add(term));
  return [...terms].filter(Boolean);
}

function normalizePaymentMethod(method) {
  return method === 'momo' ? 'momo' : 'cash';
}

function paymentBreakdown(amount) {
  const total = Number(amount || 0);
  const platformFee = Math.min(PLATFORM_SERVICE_FEE, Math.max(total, 0));
  return {
    amount: total,
    platformFee,
    housekeeperAmount: Math.max(total - platformFee, 0),
  };
}

function ensurePaymentSettlementColumns() {
  const statements = [
    "ALTER TABLE payments MODIFY method ENUM('cash','momo','credit_card','bank_transfer','e_wallet') NOT NULL",
    "ALTER TABLE payments ADD COLUMN platformFee DECIMAL(10,2) DEFAULT 0",
    "ALTER TABLE payments ADD COLUMN housekeeperAmount DECIMAL(10,2) DEFAULT 0",
    "ALTER TABLE payments ADD COLUMN settlementStatus ENUM('pending','holding','ready','paid','cash_collected','cancelled') DEFAULT 'pending'",
    "ALTER TABLE payments ADD COLUMN platformAccount VARCHAR(100)",
    "ALTER TABLE payments ADD COLUMN settledAt DATETIME",
    "ALTER TABLE payments ADD COLUMN payoutReference VARCHAR(100)"
  ];

  statements.forEach((sql) => {
    db.query(sql, (err) => {
      if (err && err.code !== 'ER_DUP_FIELDNAME') {
        console.error('Payment settlement migration warning:', err.message);
      }
    });
  });
}

function ensureVerificationAiColumns() {
  const statements = [
    "ALTER TABLE verification_requests ADD COLUMN aiStatus ENUM('not_configured','pending','passed','failed','needs_review','error') DEFAULT 'pending'",
    "ALTER TABLE verification_requests ADD COLUMN aiProvider VARCHAR(50)",
    "ALTER TABLE verification_requests ADD COLUMN aiScore DECIMAL(8,2)",
    "ALTER TABLE verification_requests ADD COLUMN aiOcrName VARCHAR(255)",
    "ALTER TABLE verification_requests ADD COLUMN aiOcrIdNumber VARCHAR(64)",
    "ALTER TABLE verification_requests ADD COLUMN aiOcrDob VARCHAR(64)",
    "ALTER TABLE verification_requests ADD COLUMN aiOcrAddress TEXT",
    "ALTER TABLE verification_requests ADD COLUMN aiOcrFront JSON",
    "ALTER TABLE verification_requests ADD COLUMN aiOcrBack JSON",
    "ALTER TABLE verification_requests ADD COLUMN aiFaceMatch JSON",
    "ALTER TABLE verification_requests ADD COLUMN aiRawResult JSON",
    "ALTER TABLE verification_requests ADD COLUMN aiCheckedAt DATETIME"
  ];

  statements.forEach((sql) => {
    db.query(sql, (err) => {
      if (err && err.code !== 'ER_DUP_FIELDNAME') {
        console.error('Verification AI migration warning:', err.message);
      }
    });
  });
}

function ensureVerificationDocumentColumns() {
  const statements = [
    "ALTER TABLE verification_documents MODIFY documentType ENUM('id_card_front','id_card_back','selfie','certificate','license','insurance','other') NOT NULL",
    "ALTER TABLE verification_documents ADD COLUMN requestId INT NULL AFTER userId",
    "ALTER TABLE verification_documents ADD INDEX idx_request_status (requestId, status)"
  ];

  statements.forEach((sql) => {
    db.query(sql, (err) => {
      if (err && err.code !== 'ER_DUP_FIELDNAME' && err.code !== 'ER_DUP_KEYNAME') {
        console.error('Verification document migration warning:', err.message);
      }
    });
  });
}

function uploadedFilePathToAbsolute(filePath) {
  const relativePath = String(filePath || '')
    .replace(/^https?:\/\/[^/]+\/uploads\//, '')
    .replace(/^\/?uploads[\\/]/, '')
    .replace(/\\/g, '/');
  const absolutePath = path.resolve(uploadsDir, relativePath);

  if (!absolutePath.startsWith(uploadsDir)) {
    throw new Error('Invalid uploaded file path');
  }

  return absolutePath;
}

function mimeTypeForFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

async function appendLocalImage(formData, fieldName, filePath) {
  const absolutePath = uploadedFilePathToAbsolute(filePath);
  const fileBuffer = await fs.promises.readFile(absolutePath);
  const blob = new Blob([fileBuffer], { type: mimeTypeForFile(absolutePath) });
  formData.append(fieldName, blob, path.basename(absolutePath));
}

async function callFptIdRecognition(filePath) {
  const formData = new FormData();
  await appendLocalImage(formData, 'image', filePath);

  const response = await axios.post(FPT_ID_RECOGNITION_ENDPOINT, formData, {
    headers: {
      api_key: FPT_AI_API_KEY,
      'api-key': FPT_AI_API_KEY,
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    timeout: FPT_AI_TIMEOUT_MS,
  });

  return response.data;
}

async function callFptFaceMatch(idCardFrontPath, selfiePath) {
  const formData = new FormData();
  await appendLocalImage(formData, 'file[]', idCardFrontPath);
  await appendLocalImage(formData, 'file[]', selfiePath);

  const response = await axios.post(FPT_FACE_MATCH_ENDPOINT, formData, {
    headers: {
      api_key: FPT_AI_API_KEY,
      'api-key': FPT_AI_API_KEY,
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    timeout: FPT_AI_TIMEOUT_MS,
  });

  return response.data;
}

function firstFptDataItem(result) {
  if (Array.isArray(result?.data)) return result.data[0] || {};
  if (result?.data && typeof result.data === 'object') return result.data;
  return {};
}

function numberFromUnknown(value) {
  if (value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function extractFaceScore(result) {
  const candidates = [
    result?.similarity,
    result?.score,
    result?.data?.similarity,
    result?.data?.score,
    result?.data?.confidence,
    result?.data?.result?.similarity,
    result?.data?.result?.score,
  ];

  for (const candidate of candidates) {
    const score = numberFromUnknown(candidate);
    if (score !== null) return score <= 1 ? score * 100 : score;
  }

  return null;
}

function extractFaceMatched(result, score) {
  const candidates = [
    result?.isMatch,
    result?.is_match,
    result?.matched,
    result?.data?.isMatch,
    result?.data?.is_match,
    result?.data?.matched,
    result?.data?.result?.isMatch,
  ];

  for (const candidate of candidates) {
    if (candidate === true || candidate === 1 || candidate === '1') return true;
    if (candidate === false || candidate === 0 || candidate === '0') return false;
    if (typeof candidate === 'string') {
      const normalized = candidate.toLowerCase();
      if (['true', 'match', 'matched', 'yes'].includes(normalized)) return true;
      if (['false', 'not_match', 'not matched', 'no'].includes(normalized)) return false;
    }
  }

  return score !== null ? score >= FPT_FACE_MATCH_PASS_SCORE : false;
}

function buildAiDecision(frontResult, backResult, faceResult) {
  const frontData = firstFptDataItem(frontResult);
  const backData = firstFptDataItem(backResult);
  const faceScore = extractFaceScore(faceResult);
  const faceMatched = extractFaceMatched(faceResult, faceScore);
  const frontOk = Number(frontResult?.errorCode ?? 0) === 0 && Boolean(frontData.id || frontData.name);
  const backOk = Number(backResult?.errorCode ?? 0) === 0 && Boolean(backData.issue_date || backData.features || backData.type);

  let aiStatus = 'needs_review';
  if (frontOk && backOk && faceMatched) {
    aiStatus = 'passed';
  } else if (!frontOk || !faceMatched) {
    aiStatus = 'failed';
  }

  return {
    aiStatus,
    aiScore: faceScore,
    aiOcrName: frontData.name || null,
    aiOcrIdNumber: frontData.id || null,
    aiOcrDob: frontData.dob || null,
    aiOcrAddress: frontData.address || null,
    aiOcrFront: frontData,
    aiOcrBack: backData,
    aiFaceMatch: {
      ...((faceResult && typeof faceResult === 'object') ? faceResult : { result: faceResult }),
      normalized: {
        isMatch: faceMatched,
        score: faceScore,
      },
    },
    aiRawResult: {
      front: frontResult,
      back: backResult,
      faceMatch: faceResult,
    },
  };
}

function updateVerificationAiResult(requestId, aiResult) {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE verification_requests
      SET aiStatus = ?, aiProvider = ?, aiScore = ?, aiOcrName = ?, aiOcrIdNumber = ?,
          aiOcrDob = ?, aiOcrAddress = ?, aiOcrFront = ?, aiOcrBack = ?,
          aiFaceMatch = ?, aiRawResult = ?, aiCheckedAt = NOW()
      WHERE id = ?
    `;

    db.query(sql, [
      aiResult.aiStatus,
      'fpt_ai',
      aiResult.aiScore,
      aiResult.aiOcrName,
      aiResult.aiOcrIdNumber,
      aiResult.aiOcrDob,
      aiResult.aiOcrAddress,
      JSON.stringify(aiResult.aiOcrFront || {}),
      JSON.stringify(aiResult.aiOcrBack || {}),
      JSON.stringify(aiResult.aiFaceMatch || {}),
      JSON.stringify(aiResult.aiRawResult || {}),
      requestId,
    ], (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

async function runVerificationAiCheck(requestId, documents) {
  if (!FPT_AI_API_KEY) {
    const notConfiguredResult = {
      aiStatus: 'not_configured',
      aiScore: null,
      aiOcrName: null,
      aiOcrIdNumber: null,
      aiOcrDob: null,
      aiOcrAddress: null,
      aiOcrFront: {},
      aiOcrBack: {},
      aiFaceMatch: {},
      aiRawResult: { error: 'Missing FPT_AI_API_KEY' },
    };
    await updateVerificationAiResult(requestId, notConfiguredResult);
    return notConfiguredResult;
  }

  const idCardFront = documents.find((doc) => doc.type === 'id_card_front');
  const idCardBack = documents.find((doc) => doc.type === 'id_card_back');
  const selfie = documents.find((doc) => doc.type === 'selfie');

  if (!idCardFront?.path || !idCardBack?.path || !selfie?.path) {
    const missingResult = {
      aiStatus: 'needs_review',
      aiScore: null,
      aiOcrName: null,
      aiOcrIdNumber: null,
      aiOcrDob: null,
      aiOcrAddress: null,
      aiOcrFront: {},
      aiOcrBack: {},
      aiFaceMatch: {},
      aiRawResult: { error: 'Missing id_card_front, id_card_back, or selfie document' },
    };
    await updateVerificationAiResult(requestId, missingResult);
    return missingResult;
  }

  try {
    const [frontResult, backResult, faceResult] = await Promise.all([
      callFptIdRecognition(idCardFront.path),
      callFptIdRecognition(idCardBack.path),
      callFptFaceMatch(idCardFront.path, selfie.path),
    ]);
    const aiResult = buildAiDecision(frontResult, backResult, faceResult);
    await updateVerificationAiResult(requestId, aiResult);
    return aiResult;
  } catch (error) {
    const errorResult = {
      aiStatus: 'error',
      aiScore: null,
      aiOcrName: null,
      aiOcrIdNumber: null,
      aiOcrDob: null,
      aiOcrAddress: null,
      aiOcrFront: {},
      aiOcrBack: {},
      aiFaceMatch: {},
      aiRawResult: {
        error: error.message,
        response: error.response?.data || null,
      },
    };
    await updateVerificationAiResult(requestId, errorResult);
    return errorResult;
  }
}

const ACCESS_POLICIES = [
  { methods: ['POST'], pattern: /^\/api\/register$/, public: true },
  { methods: ['POST'], pattern: /^\/api\/login$/, public: true },
  { methods: ['POST'], pattern: /^\/api\/auth\/google$/, public: true },
  { methods: ['GET'], pattern: /^\/api\/housekeepers$/, public: true },
  { methods: ['GET'], pattern: /^\/api\/housekeepers\/\d+$/, public: true },
  { methods: ['GET'], pattern: /^\/api\/reviews\/housekeeper\/\d+$/, public: true },
  { methods: ['GET'], pattern: /^\/api\/housekeepers\/\d+\/reviews$/, public: true },
  { methods: ['GET'], pattern: /^\/api\/filters\//, public: true },
  { methods: ['POST'], pattern: /^\/api\/chatbot\/(message|calculate-cost|combo-recommendations|save-conversation)$/, public: true },

  { methods: ['*'], pattern: /^\/api\/admin(\/|$)/, roles: ['admin'] },
  { methods: ['*'], pattern: /^\/api\/debug(\/|$)/, roles: ['admin'] },

  { methods: ['POST'], pattern: /^\/api\/quick-booking\/create$/, roles: ['customer'] },
  { methods: ['POST'], pattern: /^\/api\/bookings$/, roles: ['customer'] },
  { methods: ['POST'], pattern: /^\/api\/bookings\/\d+\/cancel$/, roles: ['customer'] },
  { methods: ['POST'], pattern: /^\/api\/bookings\/\d+\/confirm-payment$/, roles: ['customer'] },
  { methods: ['POST'], pattern: /^\/api\/reviews$/, roles: ['customer'] },
  { methods: ['POST'], pattern: /^\/api\/reports$/, roles: ['customer'] },
  { methods: ['POST'], pattern: /^\/api\/coupons\/use$/, roles: ['customer'] },
  { methods: ['POST'], pattern: /^\/api\/coupons\/validate$/, roles: ['customer'] },

  { methods: ['POST'], pattern: /^\/api\/bookings\/\d+\/confirm$/, roles: ['housekeeper'] },
  { methods: ['POST'], pattern: /^\/api\/bookings\/\d+\/reject$/, roles: ['housekeeper'] },
  { methods: ['POST'], pattern: /^\/api\/bookings\/\d+\/complete$/, roles: ['housekeeper'] },
  { methods: ['PUT'], pattern: /^\/api\/housekeepers\/\d+\/availability$/, roles: ['housekeeper', 'admin'] },
  { methods: ['GET'], pattern: /^\/api\/housekeepers\/\d+\/earnings$/, roles: ['housekeeper', 'admin'] },
  { methods: ['POST'], pattern: /^\/api\/verification\/submit$/, roles: ['housekeeper'] },

  { methods: ['GET'], pattern: /^\/api\/users$/, roles: ['admin'] },
  { methods: ['GET'], pattern: /^\/api\/reports$/, roles: ['admin'] },
  { methods: ['PUT'], pattern: /^\/api\/reports\/\d+$/, roles: ['admin'] },
  { methods: ['POST'], pattern: /^\/api\/warnings$/, roles: ['admin'] },
  { methods: ['GET'], pattern: /^\/api\/warnings$/, roles: ['admin'] },
  { methods: ['PUT'], pattern: /^\/api\/warnings\/\d+\/read$/, roles: ['admin', 'housekeeper'] },
];

const signAccessToken = (user) => jwt.sign(
  { id: user.id, role: user.role, email: user.email },
  JWT_SECRET,
  { expiresIn: JWT_EXPIRES_IN }
);

const extractToken = (req) => {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7).trim();
};

const findPolicy = (method, pathname) => ACCESS_POLICIES.find((policy) => {
  const methodMatch = policy.methods.includes('*') || policy.methods.includes(method);
  return methodMatch && policy.pattern.test(pathname);
});

const authenticateJWT = (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Thiếu access token'
    });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch (error) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Access token không hợp lệ hoặc đã hết hạn'
    });
  }
};

const sameUser = (value, currentUserId) => Number(value) === Number(currentUserId);

app.use((req, res, next) => {
  if (!req.path.startsWith('/api/')) return next();

  const policy = findPolicy(req.method, req.path);
  if (policy?.public) return next();

  return authenticateJWT(req, res, () => {
    if (policy?.roles && !policy.roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Bạn không có quyền truy cập tài nguyên này'
      });
    }

    // Owner-based guard cho user profile/files routes
    const userScopedMatch = req.path.match(/^\/api\/users\/(\d+)(?:\/profile|\/files)?$/);
    if (userScopedMatch && req.user.role !== 'admin') {
      const targetUserId = userScopedMatch[1];
      if (!sameUser(targetUserId, req.user.id)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Bạn chỉ có thể truy cập dữ liệu của chính mình'
        });
      }
    }

    const notificationMatch = req.path.match(/^\/api\/notifications\/(\d+)$/);
    if (req.method === 'GET' && notificationMatch && req.user.role !== 'admin') {
      if (!sameUser(notificationMatch[1], req.user.id)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Bạn chỉ có thể truy cập thông báo của chính mình'
        });
      }
    }

    const customerReportMatch = req.path.match(/^\/api\/reports\/customer\/(\d+)$/);
    if (customerReportMatch && req.user.role !== 'admin') {
      if (!sameUser(customerReportMatch[1], req.user.id)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Bạn chỉ có thể xem báo cáo của chính mình'
        });
      }
    }

    const bookingUserMatch = req.path.match(/^\/api\/bookings\/user\/(\d+)$/);
    if (bookingUserMatch && req.user.role !== 'admin') {
      if (!sameUser(bookingUserMatch[1], req.user.id)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Bạn chỉ có thể xem lịch sử booking của chính mình'
        });
      }
    }

    const conversationMatch = req.path.match(/^\/api\/users\/(\d+)\/(conversations|user-conversations)$/);
    if (conversationMatch && req.user.role !== 'admin') {
      if (!sameUser(conversationMatch[1], req.user.id)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Bạn chỉ có thể xem hội thoại của chính mình'
        });
      }
    }

    return next();
  });
});

// Initialize Chatbot Service
const chatbotService = new ChatbotService();

// API: Lấy tất cả housekeepers (filter dịch vụ theo bảng housekeeper_services, OR logic)
app.get('/api/housekeepers', (req, res) => {
  const { services, exactRating, maxPrice, available, topRated } = req.query;
  
  // Nếu có filter services, trước tiên cần chuyển tên service thành serviceId
  if (services) {
    const serviceNames = services.split(",");
    const serviceTerms = serviceNames.flatMap(serviceSearchTerms);
    const getServiceIdsSql = `SELECT id FROM services WHERE name IN (${serviceNames.map(() => "?").join(",")})`;
    
    db.query(getServiceIdsSql, serviceNames, (err, serviceResults) => {
      if (err) return res.status(500).json({ error: err });
      
      console.log('ServiceNames:', serviceNames);
      console.log('ServiceResults:', serviceResults);
      
      const serviceIds = serviceResults.map(s => s.id);
      console.log('ServiceIds:', serviceIds);
      
      if (serviceIds.length === 0 && serviceTerms.length === 0) {
        console.log('No services found, returning empty array');
        return res.json([]); // Không có service nào match
      }
      
      // Tiếp tục với query chính
      executeMainQuery(serviceIds, serviceTerms);
    });
  } else {
    // Không có filter services, query bình thường
    executeMainQuery(null, []);
  }
  
  function executeMainQuery(serviceIds, serviceTerms = []) {
    let sql = `
      SELECT h.*, u.fullName, u.email, u.phone, u.avatar, u.address, u.city, u.district, u.isVerified, u.isApproved,
             COALESCE(AVG(r.rating), 0) as avgRating,
             COUNT(r.id) as reviewCount
      FROM housekeepers h
      JOIN users u ON h.userId = u.id
      LEFT JOIN reviews r ON h.id = r.housekeeperId
    `;
    const where = [`u.isApproved = 1 AND u.isVerified = 1`];
    const having = [];
    const params = [];

    if ((serviceIds && serviceIds.length > 0) || serviceTerms.length > 0) {
      sql += ` LEFT JOIN housekeeper_services hs ON h.id = hs.housekeeperId`;
      const serviceConditions = [];
      if (serviceIds && serviceIds.length > 0) {
        serviceConditions.push(`hs.serviceId IN (${serviceIds.map(() => "?").join(",")})`);
        params.push(...serviceIds);
      }
      if (serviceTerms.length > 0) {
        serviceConditions.push(`(${serviceTerms.map(() => 'LOWER(h.services) LIKE LOWER(?)').join(' OR ')})`);
        params.push(...serviceTerms.map((term) => `%${term}%`));
      }
      where.push(`(${serviceConditions.join(' OR ')})`);
    }
    if (maxPrice) {
      where.push(`h.price <= ?`);
      params.push(Number(maxPrice));
    }
    if (available) {
      where.push(`h.available = ?`);
      params.push(Number(available));
    }

    if (where.length) {
      sql += ` WHERE ` + where.join(" AND ");
    }
    sql += ` GROUP BY h.id, h.userId, h.rating, h.totalReviews, h.services, h.price, h.priceType, h.available, h.description, h.experience, h.skills, h.certifications, h.workingDays, h.workingHours, h.serviceRadius, h.profileImages, h.hasInsurance, h.completedJobs, h.responseTime, h.isTopRated, h.backgroundChecked, h.insured, h.createdAt, h.updatedAt, u.fullName, u.email, u.phone, u.avatar, u.address, u.city, u.district, u.isVerified, u.isApproved`;
    
    // BỎ HAVING COUNT(DISTINCT hs.serviceId) = ... để filter OR
    if (exactRating) {
      // Lọc theo rating chính xác (ví dụ: 4 sao = 4.0-4.9)
      having.push(`AVG(r.rating) >= ? AND AVG(r.rating) < ?`);
      params.push(Number(exactRating));
      params.push(Number(exactRating) + 1);
    }
    
    // Filter top-rated (rating >= 4.5 và có ít nhất 10 reviews)
    if (topRated === 'true') {
      having.push(`AVG(r.rating) >= 4.5 AND COUNT(r.id) >= 5`);
    }
    
    if (having.length) {
      sql += ` HAVING ` + having.join(" AND ");
    }
    
    // Sắp xếp: Top-rated theo rating cao nhất, còn lại theo thứ tự bình thường
    if (topRated === 'true') {
      sql += ` ORDER BY AVG(r.rating) DESC, COUNT(r.id) DESC`;
    } else {
      sql += ` ORDER BY h.isTopRated DESC, AVG(r.rating) DESC`;
    }

    
    db.query(sql, params, (err, results) => {
      if (err) {
        console.log('SQL Error:', err);
        return res.status(500).json({ error: err });
      }
      
      // Lọc thêm một lần nữa để đảm bảo chỉ có housekeeper đã xác minh
      const verifiedResults = results.filter(hk => {
        const isVerified = hk.isVerified === 1 || hk.isVerified === true;
        const isApproved = hk.isApproved === 1 || hk.isApproved === true;
        return isVerified && isApproved;
      });
      
      const housekeepersWithInitials = verifiedResults.map(hk => ({
        ...hk,
        initials: hk.fullName.split(' ').map(n => n[0]).join('').toUpperCase(),
        rating: parseFloat(hk.avgRating).toFixed(1)
      }));
      res.json(housekeepersWithInitials);
    });
  }
});

// API: Housekeeper toggle tam nghi / nhan viec
app.put('/api/housekeepers/:userId/availability', (req, res) => {
  const { userId } = req.params;
  const { available } = req.body;

  if (available === undefined) {
    return res.status(400).json({ error: 'available is required' });
  }

  if (req.user && req.user.role !== 'admin' && Number(req.user.id) !== Number(userId)) {
    return res.status(403).json({ error: 'Ban chi co the cap nhat trang thai cua chinh minh' });
  }

  const value = available ? 1 : 0;
  db.query(
    'UPDATE housekeepers SET available = ?, lastOnline = NOW(), updatedAt = NOW() WHERE userId = ?',
    [value, userId],
    (err, result) => {
      if (err) {
        console.error('Error updating housekeeper availability:', err);
        return res.status(500).json({ error: err.message });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Housekeeper not found' });
      }

      db.query(
        'SELECT h.*, u.fullName, u.email, u.phone, u.avatar, u.address, u.city, u.district, u.isVerified, u.isApproved, u.avatar FROM housekeepers h JOIN users u ON h.userId = u.id WHERE h.userId = ?',
        [userId],
        (selectErr, rows) => {
          if (selectErr) {
            console.error('Error loading updated housekeeper availability:', selectErr);
            return res.status(500).json({ error: selectErr.message });
          }

          res.json(rows[0] || { userId: Number(userId), available: value });
        }
      );
    }
  );
});
// API: Lấy thông tin housekeeper theo ID
app.get('/api/housekeepers/:id', (req, res) => {
  const housekeeperId = req.params.id;
  
  let sql = `
    SELECT h.*, u.fullName, u.email, u.phone, u.avatar, u.address, u.city, u.district, u.isVerified, u.isApproved,
           COALESCE(AVG(r.rating), 0) as avgRating,
           COUNT(r.id) as reviewCount
    FROM housekeepers h
    JOIN users u ON h.userId = u.id
    LEFT JOIN reviews r ON h.id = r.housekeeperId
    WHERE h.id = ? OR h.userId = ?
    GROUP BY h.id, h.userId, h.rating, h.totalReviews, h.services, h.price, h.priceType, h.available, h.description, h.experience, h.skills, h.certifications, h.workingDays, h.workingHours, h.serviceRadius, h.profileImages, h.hasInsurance, h.completedJobs, h.responseTime, h.isTopRated, h.backgroundChecked, h.insured, h.createdAt, h.updatedAt, u.fullName, u.email, u.phone, u.avatar, u.address, u.city, u.district, u.isVerified, u.isApproved
  `;
  
  db.query(sql, [housekeeperId, housekeeperId], (err, results) => {
    if (err) {
      console.log('SQL Error:', err);
      return res.status(500).json({ error: err });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ error: 'Housekeeper not found' });
    }
    
    const hk = results[0];
    const initials = hk.fullName.split(' ').map(n => n[0]).join('').toUpperCase();
    const housekeeperWithDetails = {
      ...hk,
      initials: initials,
      rating: parseFloat(hk.avgRating).toFixed(1),
      reviewCount: hk.reviewCount,
      avatar: hk.avatar,
      backgroundChecked: Boolean(hk.backgroundChecked === 1 || hk.backgroundChecked === true),
      insured: Boolean(hk.insured === 1 || hk.insured === true || hk.hasInsurance === 1 || hk.hasInsurance === true),
      location: [hk.district, hk.city].filter(Boolean).join(', ') || hk.address || "Location not specified",
      bio: hk.description || "Professional housekeeper with experience.",
      phoneNumber: hk.phone,
      availability: hk.available ? "Available today" : "Not available"
    };
    
    res.json(housekeeperWithDetails);
  });
});

// API: Đăng ký user mới
app.post('/api/register', (req, res) => {
  const { 
    fullName, 
    email, 
    password, 
    phone, 
    role, 
    idCardFront, 
    idCardBack, 
    services,
    address,
    city,
    district,
    dateOfBirth,
    gender,
    emergencyContact
  } = req.body;

  console.log('📝 Registration request:', { fullName, email, role, phone });

  // Validation
  if (!fullName || !email || !password) {
    return res.status(400).json({ 
      error: 'Thiếu thông tin bắt buộc',
      message: 'Họ tên, email và mật khẩu là bắt buộc' 
    });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ 
      error: 'Email không hợp lệ',
      message: 'Vui lòng nhập đúng định dạng email' 
    });
  }

  // Validate password strength
  if (password.length < 6) {
    return res.status(400).json({ 
      error: 'Mật khẩu quá ngắn',
      message: 'Mật khẩu phải có ít nhất 6 ký tự' 
    });
  }

  // Check if email already exists
  db.query('SELECT id FROM users WHERE email = ?', [email], (err, existingUsers) => {
    if (err) {
      console.error('Database error checking email:', err);
      return res.status(500).json({ error: 'Lỗi hệ thống', message: 'Không thể kiểm tra email' });
    }

    if (existingUsers.length > 0) {
      return res.status(409).json({ 
        error: 'Email đã tồn tại',
        message: 'Email này đã được đăng ký. Vui lòng sử dụng email khác hoặc đăng nhập.' 
      });
    }

    // bcrypt: mỗi lần hashSync cho cùng một mật khẩu cho chuỗi khác nhau (salt); kiểm tra luôn dùng compareSync
    const hashedPassword = bcrypt.hashSync(password, 10);

    const normalizedRole = role || 'customer';
    const normalizedEmergencyContact = emergencyContact || (normalizedRole === 'housekeeper' ? phone : null);
    const sql = `INSERT INTO users 
      (fullName, email, password, phone, role, idCardFront, idCardBack, address, city, district, dateOfBirth, gender, emergencyContact, authProvider) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local')`;
    
    const values = [
      fullName, 
      email, 
      hashedPassword, 
      phone, 
      normalizedRole, 
      idCardFront, 
      idCardBack,
      address,
      city,
      district,
      dateOfBirth,
      gender,
      normalizedEmergencyContact
    ];

    db.query(sql, values, (err, result) => {
      if (err) {
        console.error('Database error creating user:', err);
        return res.status(500).json({ error: 'Lỗi tạo tài khoản', message: err.message });
      }
      
      const userId = result.insertId;
      console.log('✅ User created with ID:', userId);
      
      // Nếu là housekeeper, tạo housekeeper record
      if (normalizedRole === 'housekeeper') {
        const housekeeperSql = `INSERT INTO housekeepers 
          (userId, rating, services, price, available, description, experience) 
          VALUES (?, 0, ?, 50000, 1, 'Người giúp việc mới tham gia', 0)`;
        
        const servicesString = services && services.length > 0 ? services.join(',') : '';
        
        db.query(housekeeperSql, [userId, servicesString], (err, housekeeperResult) => {
          if (err) {
            console.error('Error creating housekeeper record:', err);
            return res.status(500).json({ error: 'Lỗi tạo hồ sơ người giúp việc', message: err.message });
          }
          
          const housekeeperId = housekeeperResult.insertId;
          console.log('✅ Housekeeper record created with ID:', housekeeperId);
          
          // Liên kết services nếu có
          if (services && services.length > 0) {
            const getServiceIdsSql = `SELECT id, name FROM services WHERE name IN (${services.map(() => "?").join(",")})`;
            
            db.query(getServiceIdsSql, services, (err, serviceResults) => {
              if (err) {
                console.error('Error fetching services:', err);
              } else {
                // Tạo các liên kết trong housekeeper_services
                const insertPromises = serviceResults.map(service => {
                  return new Promise((resolve, reject) => {
                    db.query('INSERT INTO housekeeper_services (housekeeperId, serviceId) VALUES (?, ?)', 
                      [housekeeperId, service.id], (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                      });
                  });
                });
                
                Promise.all(insertPromises)
                  .then(() => {
                    console.log('✅ Housekeeper services linked');
                  })
                  .catch(err => {
                    console.error('Error linking services:', err);
                  });
              }
            });
          }
          
          // Return success response for housekeeper
          res.status(201).json({ 
            success: true,
            message: 'Đăng ký thành công! Tài khoản của bạn đang chờ xét duyệt.',
            accessToken: signAccessToken({ id: userId, role: normalizedRole, email }),
            user: { 
              id: userId, 
              fullName, 
              email, 
              phone, 
              role: normalizedRole,
              housekeeperId,
              isVerified: false,
              isApproved: false
            }
          });
        });
      } else {
        // Return success response for customer
        res.status(201).json({ 
          success: true,
          message: 'Đăng ký thành công! Chào mừng bạn đến với HouseHelp.',
          accessToken: signAccessToken({ id: userId, role: normalizedRole, email }),
          user: { 
            id: userId, 
            fullName, 
            email, 
            phone, 
            role: normalizedRole,
            isVerified: false,
            isApproved: true // Customer auto-approved
          }
        });
      }

      // Log registration activity
      db.query('INSERT INTO system_logs (userId, action, description, ipAddress) VALUES (?, ?, ?, ?)', 
        [userId, 'USER_REGISTERED', `New ${normalizedRole} registered: ${fullName}`, req.ip], 
        (err) => {
          if (err) console.error('Error logging registration:', err);
        });
    });
  });
});

// ========================
// FILE UPLOAD APIs
// ========================

// API: Upload single file
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        error: 'Không có file được upload',
        message: 'Vui lòng chọn file để upload' 
      });
    }

    const { userId, fileType } = req.body;
    const uploadFileType = normalizeFileUploadType(fileType);
    
    if (!userId) {
      return res.status(400).json({ 
        error: 'Thiếu thông tin userId',
        message: 'Cần có userId để upload file' 
      });
    }

    const file = req.file;
    const filePath = `/uploads/${path.relative(uploadsDir, file.path)}`.replace(/\\/g, '/');
    
    console.log('📁 File uploaded:', {
      originalName: file.originalname,
      filename: file.filename,
      path: filePath,
      size: file.size,
      type: uploadFileType,
      requestedType: fileType
    });

    // Save file info to database
    const sql = `INSERT INTO file_uploads 
      (userId, fileName, originalName, filePath, fileType, mimeType, fileSize) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`;
    
    db.query(sql, [
      userId, 
      file.filename, 
      file.originalname, 
      filePath, 
      uploadFileType, 
      file.mimetype, 
      file.size
    ], (err, result) => {
      if (err) {
        console.error('Error saving file info to database:', err);
        return res.status(500).json({ error: 'Lỗi lưu thông tin file', message: err.message });
      }

      // Update user's avatar or ID card fields if applicable
      if (uploadFileType === 'avatar') {
        db.query('UPDATE users SET avatar = ? WHERE id = ?', [filePath, userId], (updateErr) => {
          if (updateErr) console.error('Error updating user avatar:', updateErr);
        });
      } else if (uploadFileType === 'id_card_front') {
        db.query('UPDATE users SET idCardFront = ? WHERE id = ?', [filePath, userId], (updateErr) => {
          if (updateErr) console.error('Error updating ID card front:', updateErr);
        });
      } else if (uploadFileType === 'id_card_back') {
        db.query('UPDATE users SET idCardBack = ? WHERE id = ?', [filePath, userId], (updateErr) => {
          if (updateErr) console.error('Error updating ID card back:', updateErr);
        });
      }

      res.json({
        success: true,
        message: 'Upload file thành công',
        file: {
          id: result.insertId,
          filename: file.filename,
          originalName: file.originalname,
          path: filePath,
          url: publicFileUrl(filePath),
          size: file.size,
          type: uploadFileType
        }
      });
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: 'Lỗi upload file',
      message: error.message 
    });
  }
});

// API: Upload multiple files
app.post('/api/upload-multiple', upload.array('files', 5), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ 
        error: 'Không có file được upload',
        message: 'Vui lòng chọn ít nhất một file để upload' 
      });
    }

    const { userId, fileType } = req.body;
    const uploadFileType = normalizeFileUploadType(fileType);
    
    if (!userId) {
      return res.status(400).json({ 
        error: 'Thiếu thông tin userId',
        message: 'Cần có userId để upload file' 
      });
    }

    const uploadedFiles = [];
    const insertPromises = req.files.map(file => {
      const filePath = `/uploads/${path.relative(uploadsDir, file.path)}`.replace(/\\/g, '/');
      
      return new Promise((resolve, reject) => {
        const sql = `INSERT INTO file_uploads 
          (userId, fileName, originalName, filePath, fileType, mimeType, fileSize) 
          VALUES (?, ?, ?, ?, ?, ?, ?)`;
        
        db.query(sql, [
          userId, 
          file.filename, 
          file.originalname, 
          filePath, 
          uploadFileType, 
          file.mimetype, 
          file.size
        ], (err, result) => {
          if (err) {
            reject(err);
          } else {
            uploadedFiles.push({
              id: result.insertId,
              filename: file.filename,
              originalName: file.originalname,
              path: filePath,
              url: publicFileUrl(filePath),
              size: file.size,
              type: uploadFileType
            });
            resolve(result);
          }
        });
      });
    });

    Promise.all(insertPromises)
      .then(() => {
        res.json({
          success: true,
          message: `Upload thành công ${uploadedFiles.length} file`,
          files: uploadedFiles
        });
      })
      .catch(err => {
        console.error('Error saving multiple files:', err);
        res.status(500).json({ 
          error: 'Lỗi lưu thông tin file',
          message: err.message 
        });
      });

  } catch (error) {
    console.error('Multiple upload error:', error);
    res.status(500).json({ 
      error: 'Lỗi upload file',
      message: error.message 
    });
  }
});

// API: Get user's uploaded files
app.get('/api/users/:userId/files', (req, res) => {
  const { userId } = req.params;
  const { fileType } = req.query;
  
  let sql = 'SELECT * FROM file_uploads WHERE userId = ?';
  const params = [userId];
  
  if (fileType) {
    sql += ' AND fileType = ?';
    params.push(fileType);
  }
  
  sql += ' ORDER BY uploadedAt DESC';
  
  db.query(sql, params, (err, results) => {
    if (err) {
      console.error('Error fetching user files:', err);
      return res.status(500).json({ error: 'Lỗi lấy danh sách file', message: err.message });
    }
    
    const files = results.map(file => ({
      ...file,
      url: publicFileUrl(file.filePath)
    }));
    
    res.json(files);
  });
});

// API: Delete uploaded file
app.delete('/api/files/:fileId', (req, res) => {
  const { fileId } = req.params;
  
  // Get file info first
  db.query('SELECT * FROM file_uploads WHERE id = ?', [fileId], (err, results) => {
    if (err) {
      console.error('Error fetching file info:', err);
      return res.status(500).json({ error: 'Lỗi lấy thông tin file', message: err.message });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ error: 'File không tồn tại' });
    }
    
    const file = results[0];
    const fullPath = path.join(__dirname, file.filePath);
    
    // Delete file from filesystem
    fs.unlink(fullPath, (unlinkErr) => {
      if (unlinkErr) {
        console.error('Error deleting file from disk:', unlinkErr);
      }
      
      // Delete from database
      db.query('DELETE FROM file_uploads WHERE id = ?', [fileId], (deleteErr) => {
        if (deleteErr) {
          console.error('Error deleting file from database:', deleteErr);
          return res.status(500).json({ error: 'Lỗi xóa file', message: deleteErr.message });
        }
        
        res.json({
          success: true,
          message: 'Xóa file thành công'
        });
      });
    });
  });
});

// API: Đăng nhập
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  
  console.log('🔐 Login attempt:', { email });
  
  if (!email || !password) {
    return res.status(400).json({ 
      error: 'Thiếu thông tin đăng nhập',
      message: 'Email và mật khẩu là bắt buộc' 
    });
  }

  const crypto = require('crypto');

  db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
    if (err) {
      console.error('Database error during login:', err);
      return res.status(500).json({ error: 'Lỗi hệ thống', message: 'Không thể đăng nhập' });
    }

    if (results.length === 0) {
      return res.status(401).json({
        error: 'Thông tin đăng nhập không chính xác',
        message: 'Email hoặc mật khẩu không đúng'
      });
    }

    const user = results[0];
    const stored = user.password;
    if (!stored) {
      return res.status(401).json({
        error: 'Thông tin đăng nhập không chính xác',
        message: 'Email hoặc mật khẩu không đúng'
      });
    }

    let passwordOk = false;
    if (typeof stored === 'string' && stored.startsWith('$2')) {
      // Không so sánh chuỗi hash thủ công giữa các lần hashSync — chỉ dùng compareSync với hash đã lưu trong DB
      passwordOk = bcrypt.compareSync(password, stored);
    } else {
      const legacyHash = crypto.createHash('sha256').update(password).digest('hex');
      passwordOk = legacyHash === stored;
      if (passwordOk) {
        const newHash = bcrypt.hashSync(password, 10);
        db.query('UPDATE users SET password = ? WHERE id = ?', [newHash, user.id], (rehashErr) => {
          if (rehashErr) console.error('Password rehash error:', rehashErr);
        });
      }
    }

    if (!passwordOk) {
      return res.status(401).json({
        error: 'Thông tin đăng nhập không chính xác',
        message: 'Email hoặc mật khẩu không đúng'
      });
    }
    console.log('✅ Login successful for user:', user.id);
    
    // Update last active time
    db.query('UPDATE users SET lastActiveAt = NOW() WHERE id = ?', [user.id], (updateErr) => {
      if (updateErr) console.error('Error updating last active:', updateErr);
    });
    
    // Log login activity
    db.query('INSERT INTO system_logs (userId, action, description, ipAddress) VALUES (?, ?, ?, ?)', 
      [user.id, 'USER_LOGIN', `User logged in: ${user.fullName}`, req.ip], 
      (logErr) => {
        if (logErr) console.error('Error logging login:', logErr);
      });
    
    // Remove password from response
    delete user.password;
    
    res.json({
      success: true,
      message: 'Đăng nhập thành công',
      accessToken: signAccessToken(user),
      user: user
    });
  });
});

// ========================
// VERIFICATION & APPROVAL APIs
// ========================

// API: Submit verification request
app.post('/api/verification/submit', (req, res) => {
  const { userId, userNotes, documents } = req.body;
  
  console.log('📋 Verification request submitted:', { userId, documents: documents?.length });
  
  if (!userId) {
    return res.status(400).json({ 
      error: 'Thiếu thông tin userId',
      message: 'Cần có userId để gửi yêu cầu xác thực' 
    });
  }

  return db.query(
    'SELECT id, submittedAt, TIMESTAMPDIFF(MINUTE, submittedAt, NOW()) AS minutesSince FROM verification_requests WHERE userId = ? ORDER BY submittedAt DESC LIMIT 1',
    [userId],
    (cooldownErr, cooldownRows) => {
      if (cooldownErr) {
        console.error('Error checking verification cooldown:', cooldownErr);
        return res.status(500).json({ error: 'Could not check verification cooldown', message: cooldownErr.message });
      }

      const latestRequest = cooldownRows?.[0];
      const minutesSince = Number(latestRequest?.minutesSince);
      if (latestRequest && Number.isFinite(minutesSince) && minutesSince < 1440) {
        const remainingMinutes = 1440 - minutesSince;
        const remainingHours = Math.floor(remainingMinutes / 60);
        const remainingMins = remainingMinutes % 60;
        return res.status(429).json({
          error: 'Verification cooldown',
          message: `Please wait ${remainingHours}h ${remainingMins}m before submitting verification again.`,
          remainingMinutes,
        });
      }

  // Check if user exists and is housekeeper
  db.query('SELECT * FROM users WHERE id = ? AND role = "housekeeper"', [userId], (err, userResults) => {
    if (err) {
      console.error('Database error checking user:', err);
      return res.status(500).json({ error: 'Lỗi hệ thống', message: 'Không thể kiểm tra thông tin người dùng' });
    }

    if (userResults.length === 0) {
      return res.status(404).json({ error: 'Người dùng không tồn tại hoặc không phải housekeeper' });
    }

    const user = userResults[0];

    // Create verification request
    const requestSql = `INSERT INTO verification_requests 
      (userId, requestType, userNotes, submittedDocuments, priority) 
      VALUES (?, ?, ?, ?, ?)`;
    
    const priority = user.isVerified ? 'normal' : 'high'; // New users get high priority
    const requestType = user.isVerified ? 'document_update' : 'initial_verification';
    
    db.query(requestSql, [
      userId, 
      requestType, 
      userNotes || '', 
      JSON.stringify(documents || []),
      priority
    ], (err, requestResult) => {
      if (err) {
        console.error('Error creating verification request:', err);
        return res.status(500).json({ error: 'Lỗi tạo yêu cầu xác thực', message: err.message });
      }

      const requestId = requestResult.insertId;
      console.log('✅ Verification request created with ID:', requestId);

      // Save documents to verification_documents table
      if (documents && documents.length > 0) {
        const documentPromises = documents.map(doc => {
          return new Promise((resolve, reject) => {
            // Validate required fields
            if (!doc.path || !doc.type || !doc.originalName) {
              console.error('Invalid document data:', doc);
              reject(new Error(`Invalid document data: missing path, type, or originalName`));
              return;
            }
            
            const docSql = `INSERT INTO verification_documents 
              (userId, requestId, documentType, filePath, originalName) 
              VALUES (?, ?, ?, ?, ?)`;
            
            console.log('Inserting document:', { userId, type: doc.type, path: doc.path, originalName: doc.originalName });
            
            db.query(docSql, [userId, requestId, doc.type, doc.path, doc.originalName], (err, result) => {
              if (err) {
                console.error('Database error inserting document:', err);
                reject(err);
              } else {
                console.log('Document inserted successfully:', result.insertId);
                resolve(result);
              }
            });
          });
        });

        Promise.all(documentPromises)
          .then(async () => {
            console.log('All verification documents saved');
            
            const aiResult = await runVerificationAiCheck(requestId, documents || []);

            // Create notification for admins
            const notificationSql = `INSERT INTO notifications 
              (userId, type, title, message, data) 
              SELECT id, 'verification_request', 'Yêu cầu xác thực mới', ?, ? 
              FROM users WHERE role = 'admin'`;
            
            const notificationData = JSON.stringify({
              requestId: requestId,
              userId: userId,
              userName: user.fullName,
              requestType: requestType
            });

            db.query(notificationSql, [
              `${user.fullName} đã gửi yêu cầu xác thực tài khoản housekeeper`,
              notificationData
            ], (notifErr) => {
              if (notifErr) console.error('Error creating admin notification:', notifErr);
            });

            res.json({
              success: true,
              message: 'Gửi yêu cầu xác thực thành công! Admin sẽ xem xét trong vòng 24-48 giờ.',
              requestId: requestId,
              aiResult
            });
          })
          .catch(err => {
            console.error('Error saving verification documents:', err);
            res.status(500).json({ error: 'Lỗi lưu tài liệu xác thực', message: err.message });
          });
      } else {
        res.json({
          success: true,
          message: 'Gửi yêu cầu xác thực thành công! Vui lòng upload tài liệu xác thực.',
          requestId: requestId
        });
      }
    });
  });
  });
});

// API: Get verification status for user
app.get('/api/verification/status/:userId', (req, res) => {
  const { userId } = req.params;
  
  const sql = `
    SELECT 
      vr.*,
      u.fullName, u.isVerified, u.isApproved,
      admin.fullName as reviewerName
    FROM verification_requests vr
    JOIN users u ON vr.userId = u.id
    LEFT JOIN users admin ON vr.assignedTo = admin.id
    WHERE vr.userId = ?
    ORDER BY vr.submittedAt DESC
    LIMIT 1
  `;
  
  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.error('Error fetching verification status:', err);
      return res.status(500).json({ error: 'Lỗi lấy trạng thái xác thực', message: err.message });
    }
    
    if (results.length === 0) {
      return db.query(
        'SELECT isVerified, isApproved FROM users WHERE id = ? AND role = "housekeeper"',
        [userId],
        (uErr, uRows) => {
          if (uErr || !uRows || uRows.length === 0) {
            return res.json({
              hasRequest: false,
              isVerified: false,
              isApproved: false,
              message: 'Chưa có yêu cầu xác thực nào'
            });
          }
          const u = uRows[0];
          return res.json({
            hasRequest: false,
            isVerified: Boolean(u.isVerified === 1 || u.isVerified === true),
            isApproved: Boolean(u.isApproved === 1 || u.isApproved === true),
            message: 'Chưa có yêu cầu xác thực nào'
          });
        }
      );
    }
    
    const request = results[0];
    
    // Get documents for this request. Fallback to userId for legacy rows created before requestId existed.
    db.query(`
      SELECT * FROM verification_documents
      WHERE requestId = ?
         OR (
           requestId IS NULL
           AND userId = ?
           AND NOT EXISTS (SELECT 1 FROM verification_documents vd2 WHERE vd2.requestId = ?)
         )
      ORDER BY uploadedAt DESC
    `, 
      [request.id, userId, request.id], (docErr, documents) => {
        if (docErr) {
          console.error('Error fetching verification documents:', docErr);
        }
        
        const isVerified = Boolean(
          request.isVerified === 1 || request.isVerified === true
        );
        const isApproved = Boolean(
          request.isApproved === 1 || request.isApproved === true
        );

        res.json({
          hasRequest: true,
          request: request,
          documents: documents || [],
          isVerified,
          isApproved
        });
      });
  });
});

// API: Admin - Get pending verification requests
app.get('/api/admin/verification/pending', (req, res) => {
  const { status = 'pending', priority, page = 1, limit = 20 } = req.query;
  
  let sql = `
    SELECT 
      vr.*,
      u.fullName, u.email, u.phone, u.createdAt as userCreatedAt,
      h.experience, h.services,
      (SELECT COUNT(*) FROM verification_documents vd WHERE vd.requestId = vr.id) AS documentCount
    FROM verification_requests vr
    JOIN users u ON vr.userId = u.id
    LEFT JOIN housekeepers h ON u.id = h.userId
    WHERE u.role = 'housekeeper'
      AND vr.id IN (
        SELECT latestRequestId FROM (
          SELECT MAX(id) AS latestRequestId
          FROM verification_requests
          GROUP BY userId
        ) latest_requests
      )
  `;
  
  const params = [];
  
  if (status) {
    sql += ' AND vr.status = ?';
    params.push(status);
  }
  
  if (priority) {
    sql += ' AND vr.priority = ?';
    params.push(priority);
  }
  
  sql += ` ORDER BY 
             FIELD(vr.priority, 'urgent', 'high', 'normal', 'low'),
             vr.submittedAt ASC
           LIMIT ? OFFSET ?`;
  
  const offset = (page - 1) * limit;
  params.push(parseInt(limit), parseInt(offset));
  
  console.log('🔍 Verification query SQL:', sql);
  console.log('📋 Query params:', params);
  
  db.query(sql, params, (err, results) => {
    if (err) {
      console.error('Error fetching pending verifications:', err);
      return res.status(500).json({ error: 'Lỗi lấy danh sách xác thực', message: err.message });
    }
    
    console.log(`📊 Found ${results.length} pending verification requests`);
    res.json(results);
  });
});

// API: Admin - Review verification request
app.post('/api/admin/verification/:requestId/review', (req, res) => {
  const { requestId } = req.params;
  const { adminId, action, adminNotes, documentReviews } = req.body;
  
  console.log('👨‍💼 Admin reviewing verification:', { requestId, action, adminId });
  
  if (!adminId || !action) {
    return res.status(400).json({ 
      error: 'Thiếu thông tin',
      message: 'Cần có adminId và action để xem xét yêu cầu' 
    });
  }

  // Verify admin permissions
  db.query('SELECT * FROM users WHERE id = ? AND role = "admin"', [adminId], (err, adminResults) => {
    if (err) {
      console.error('Database error checking admin:', err);
      return res.status(500).json({ error: 'Lỗi hệ thống', message: 'Không thể kiểm tra quyền admin' });
    }

    if (adminResults.length === 0) {
      return res.status(403).json({ error: 'Không có quyền thực hiện thao tác này' });
    }

    // Get verification request details
    db.query('SELECT * FROM verification_requests WHERE id = ?', [requestId], (err, requestResults) => {
      if (err) {
        console.error('Error fetching verification request:', err);
        return res.status(500).json({ error: 'Lỗi lấy thông tin yêu cầu', message: err.message });
      }

      if (requestResults.length === 0) {
        return res.status(404).json({ error: 'Yêu cầu xác thực không tồn tại' });
      }

      const request = requestResults[0];
      const userId = request.userId;
      
      let newStatus, userVerified, userApproved;
      
      switch (action) {
        case 'approve':
          newStatus = 'approved';
          userVerified = true;
          userApproved = true;
          break;
        case 'reject':
          newStatus = 'rejected';
          userVerified = false;
          userApproved = false;
          break;
        case 'request_more_info':
          newStatus = 'requires_more_info';
          userVerified = false;
          userApproved = false;
          break;
        default:
          return res.status(400).json({ error: 'Action không hợp lệ' });
      }

      // Update verification request
      const updateRequestSql = `UPDATE verification_requests 
        SET status = ?, adminNotes = ?, assignedTo = ?, reviewedAt = NOW(), completedAt = ?
        WHERE id = ?`;
      
      const completedAt = (action === 'approve' || action === 'reject') ? new Date() : null;
      
      db.query(updateRequestSql, [newStatus, adminNotes, adminId, completedAt, requestId], (err) => {
        if (err) {
          console.error('Error updating verification request:', err);
          return res.status(500).json({ error: 'Lỗi cập nhật yêu cầu', message: err.message });
        }

        // Update user verification status
        db.query('UPDATE users SET isVerified = ?, isApproved = ?, verifiedAt = ? WHERE id = ?', 
          [userVerified, userApproved, userVerified ? new Date() : null, userId], (userErr) => {
            if (userErr) {
              console.error('Error updating user verification status:', userErr);
            } else {
              io.emit('housekeeper_status_updated', {
                userId: Number(userId),
                isVerified: Boolean(userVerified),
                isApproved: Boolean(userApproved),
                source: 'verification_review',
                timestamp: new Date().toISOString()
              });
            }
          });

        // Update document reviews if provided
        if (documentReviews && documentReviews.length > 0) {
          const documentPromises = documentReviews.map(review => {
            return new Promise((resolve, reject) => {
              db.query('UPDATE verification_documents SET status = ?, adminNotes = ?, reviewedBy = ?, reviewedAt = NOW() WHERE id = ?', 
                [review.status, review.notes, adminId, review.documentId], (err, result) => {
                  if (err) reject(err);
                  else resolve(result);
                });
            });
          });

          Promise.all(documentPromises).catch(err => {
            console.error('Error updating document reviews:', err);
          });
        }

        // Create notification for user
        let notificationTitle, notificationMessage;
        
        switch (action) {
          case 'approve':
            notificationTitle = '🎉 Tài khoản đã được xác thực';
            notificationMessage = 'Chúc mừng! Tài khoản housekeeper của bạn đã được xác thực và phê duyệt. Bạn có thể bắt đầu nhận việc ngay bây giờ.';
            break;
          case 'reject':
            notificationTitle = '❌ Yêu cầu xác thực bị từ chối';
            notificationMessage = `Yêu cầu xác thực của bạn đã bị từ chối. Lý do: ${adminNotes || 'Không đáp ứng yêu cầu'}. Vui lòng liên hệ hỗ trợ để biết thêm chi tiết.`;
            break;
          case 'request_more_info':
            notificationTitle = '📋 Cần bổ sung thông tin';
            notificationMessage = `Yêu cầu xác thực của bạn cần bổ sung thêm thông tin. Ghi chú: ${adminNotes || 'Vui lòng cập nhật tài liệu'}`;
            break;
        }

        db.query('INSERT INTO notifications (userId, type, title, message, data) VALUES (?, ?, ?, ?, ?)', 
          [userId, 'verification_result', notificationTitle, notificationMessage, 
           JSON.stringify({ requestId, action, adminNotes })], 
          (notifErr) => {
            if (notifErr) console.error('Error creating user notification:', notifErr);
          });

        // Log admin action
        db.query('INSERT INTO system_logs (userId, action, description, ipAddress) VALUES (?, ?, ?, ?)', 
          [adminId, 'VERIFICATION_REVIEW', `Admin reviewed verification request ${requestId}: ${action}`, req.ip], 
          (logErr) => {
            if (logErr) console.error('Error logging admin action:', logErr);
          });

        console.log(`✅ Verification request ${requestId} ${action}ed by admin ${adminId}`);

        res.json({
          success: true,
          message: `Đã ${action === 'approve' ? 'phê duyệt' : action === 'reject' ? 'từ chối' : 'yêu cầu bổ sung thông tin'} thành công`,
          newStatus: newStatus
        });
      });
    });
  });
});

// API: Admin - Get verification documents by request ID
app.get('/api/admin/verification/:requestId/documents', (req, res) => {
  const { requestId } = req.params;
  
  console.log('📄 Fetching documents for request:', requestId);
  
  // First get the userId from the verification request
  const requestSql = 'SELECT userId FROM verification_requests WHERE id = ?';
  
  db.query(requestSql, [requestId], (err, requestResults) => {
    if (err) {
      console.error('Error fetching verification request:', err);
      return res.status(500).json({ error: 'Lỗi lấy thông tin yêu cầu', message: err.message });
    }
    
    if (requestResults.length === 0) {
      return res.status(404).json({ error: 'Yêu cầu xác thực không tồn tại' });
    }
    
    const userId = requestResults[0].userId;
    
    // Get documents for this request. Fallback to user rows for legacy requests created before requestId existed.
    const documentsSql = `
      SELECT 
        id,
        documentType as type,
        filePath as url,
        originalName,
        uploadedAt,
        status
      FROM verification_documents 
      WHERE requestId = ?
         OR (
           requestId IS NULL
           AND userId = ?
           AND NOT EXISTS (SELECT 1 FROM verification_documents vd2 WHERE vd2.requestId = ?)
         )
      ORDER BY uploadedAt DESC
    `;
    
    db.query(documentsSql, [requestId, userId, requestId], (docErr, documents) => {
      if (docErr) {
        console.error('Error fetching verification documents:', docErr);
        return res.status(500).json({ error: 'Lỗi lấy tài liệu xác minh', message: docErr.message });
      }
      
      console.log(`📊 Found ${documents.length} documents for user ${userId}`);
      res.json(documents);
    });
  });
});

// ========================
// GOOGLE OAUTH APIs
// ========================

// API: Google OAuth Login/Register
app.post('/api/auth/google', (req, res) => {
  const { 
    googleId, 
    email, 
    name, 
    picture, 
    role = 'customer' 
  } = req.body;

  console.log('?? Google OAuth attempt:', { googleId, email, name, role });

  if (!googleId || !email || !name) {
    return res.status(400).json({ 
      error: 'Thi?u th�ng tin Google OAuth',
      message: 'Google ID, email v� t�n l� b?t bu?c' 
    });
  }

  // Check if user exists with this Google ID
  db.query('SELECT * FROM users WHERE googleId = ?', [googleId], (err, googleResults) => {
    if (err) {
      console.error('Database error checking Google ID:', err);
      return res.status(500).json({ error: 'L?i h? th?ng', message: 'Kh�ng th? x�c th?c Google' });
    }

    if (googleResults.length > 0) {
      // User exists with Google ID - login
      const user = googleResults[0];
      console.log('? Google login successful for existing user:', user.id);
      
      // Update last active time and profile picture
      db.query('UPDATE users SET lastActiveAt = NOW(), profilePicture = ? WHERE id = ?', 
        [picture, user.id], (updateErr) => {
          if (updateErr) console.error('Error updating user info:', updateErr);
        });
      
      // Log login activity
      db.query('INSERT INTO system_logs (userId, action, description, ipAddress) VALUES (?, ?, ?, ?)', 
        [user.id, 'GOOGLE_LOGIN', `User logged in via Google: ${user.fullName}`, req.ip], 
        (logErr) => {
          if (logErr) console.error('Error logging Google login:', logErr);
        });
      
      // Remove password from response
      delete user.password;
      
      return res.json({
        success: true,
        message: '�ang nh?p Google th�nh c�ng',
        accessToken: signAccessToken(user),
        user: user,
        isNewUser: false
      });
    }

    // Check if user exists with this email (different auth method)
    db.query('SELECT * FROM users WHERE email = ?', [email], (err, emailResults) => {
      if (err) {
        console.error('Database error checking email:', err);
        return res.status(500).json({ error: 'L?i h? th?ng', message: 'Kh�ng th? ki?m tra email' });
      }

      if (emailResults.length > 0) {
        // User exists with same email but different auth method
        const existingUser = emailResults[0];
        
        if (existingUser.authProvider === 'local') {
          return res.status(409).json({ 
            error: 'Email d� du?c dang k�',
            message: 'Email n�y d� du?c dang k� b?ng phuong th?c kh�c. Vui l�ng dang nh?p b?ng email v� m?t kh?u.' 
          });
        }
        
        // Link Google account to existing user
        db.query('UPDATE users SET googleId = ?, profilePicture = ?, authProvider = "google", lastActiveAt = NOW() WHERE id = ?', 
          [googleId, picture, existingUser.id], (linkErr) => {
            if (linkErr) {
              console.error('Error linking Google account:', linkErr);
              return res.status(500).json({ error: 'L?i li�n k?t t�i kho?n Google', message: linkErr.message });
            }
            
            console.log('? Google account linked to existing user:', existingUser.id);
            
            // Remove password from response
            delete existingUser.password;
            
            res.json({
              success: true,
              message: 'Li�n k?t t�i kho?n Google th�nh c�ng',
              accessToken: signAccessToken({ ...existingUser, role: existingUser.role, email: existingUser.email }),
              user: { ...existingUser, googleId, profilePicture: picture },
              isNewUser: false
            });
          });
        
        return;
      }

      // Create new user with Google OAuth
      const sql = `INSERT INTO users 
        (fullName, email, googleId, authProvider, profilePicture, role, isVerified, isApproved) 
        VALUES (?, ?, ?, 'google', ?, ?, 1, ?)`;
      
      const isApproved = role === 'customer' ? 1 : 0; // Auto-approve customers, not housekeepers
      
      db.query(sql, [name, email, googleId, picture, role, isApproved], (err, result) => {
        if (err) {
          console.error('Database error creating Google user:', err);
          return res.status(500).json({ error: 'L?i t?o t�i kho?n Google', message: err.message });
        }
        
        const userId = result.insertId;
        console.log('? Google user created with ID:', userId);
        
        // If housekeeper, create housekeeper record
        if (role === 'housekeeper') {
          const housekeeperSql = `INSERT INTO housekeepers 
            (userId, rating, services, price, available, description, experience) 
            VALUES (?, 0, '', 50000, 1, 'Ngu?i gi�p vi?c m?i tham gia qua Google', 0)`;
          
          db.query(housekeeperSql, [userId], (err, housekeeperResult) => {
            if (err) {
              console.error('Error creating Google housekeeper record:', err);
            } else {
              console.log('? Google housekeeper record created');
            }
          });
        }
        
        // Log registration activity
        db.query('INSERT INTO system_logs (userId, action, description, ipAddress) VALUES (?, ?, ?, ?)', 
          [userId, 'GOOGLE_REGISTER', `New ${role} registered via Google: ${name}`, req.ip], 
          (logErr) => {
            if (logErr) console.error('Error logging Google registration:', logErr);
          });
        
        res.status(201).json({ 
          success: true,
          message: '�ang k� Google th�nh c�ng! Ch�o m?ng b?n d?n v?i HouseHelp.',
          accessToken: signAccessToken({ id: userId, role, email }),
          user: { 
            id: userId, 
            fullName: name, 
            email, 
            googleId,
            authProvider: 'google',
            profilePicture: picture,
            role,
            isVerified: true,
            isApproved: isApproved === 1
          },
          isNewUser: true
        });
      });
    });
  });
});

// API: Unlink Google account
app.post('/api/auth/google/unlink', (req, res) => {
  const { userId } = req.body;
  const effectiveUserId = userId || req.user?.id;
  
  if (!effectiveUserId) {
    return res.status(400).json({ 
      error: 'Thi?u th�ng tin userId',
      message: 'C?n c� userId d? h?y li�n k?t Google' 
    });
  }

  if (req.user && req.user.role !== 'admin' && Number(effectiveUserId) !== Number(req.user.id)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'B?n ch? c� th? h?y li�n k?t t�i kho?n c?a ch�nh m�nh'
    });
  }

  // Check if user has password (can't unlink if Google is only auth method)
  db.query('SELECT password, authProvider FROM users WHERE id = ?', [effectiveUserId], (err, results) => {
    if (err) {
      console.error('Database error checking user auth:', err);
      return res.status(500).json({ error: 'L?i h? th?ng', message: 'Kh�ng th? ki?m tra th�ng tin x�c th?c' });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ error: 'Ngu?i d�ng kh�ng t?n t?i' });
    }
    
    const user = results[0];
    
    if (user.authProvider === 'google' && !user.password) {
      return res.status(400).json({ 
        error: 'Kh�ng th? h?y li�n k?t',
        message: 'B?n c?n d?t m?t kh?u tru?c khi h?y li�n k?t t�i kho?n Google' 
      });
    }
    
    // Unlink Google account
    db.query('UPDATE users SET googleId = NULL, profilePicture = NULL, authProvider = "local" WHERE id = ?', 
      [effectiveUserId], (unlinkErr) => {
        if (unlinkErr) {
          console.error('Error unlinking Google account:', unlinkErr);
          return res.status(500).json({ error: 'L?i h?y li�n k?t Google', message: unlinkErr.message });
        }
        
        console.log('? Google account unlinked for user:', effectiveUserId);
        
        res.json({
          success: true,
          message: 'H?y li�n k?t t�i kho?n Google th�nh c�ng'
        });
      });
  });
});

// API: L?y danh s�ch t?t c? users (cho Admin Dashboard)
app.get('/api/users', (req, res) => {
  const { role, verified, approved, page = 1, limit = 50 } = req.query;
  let sql = 'SELECT id, fullName, email, phone, role, isVerified, isApproved, createdAt, lastActiveAt FROM users WHERE 1=1';
  const params = [];

  // Filter theo role
  if (role) {
    sql += ' AND role = ?';
    params.push(role);
  }

  // Filter theo verified status
  if (verified !== undefined) {
    sql += ' AND isVerified = ?';
    params.push(verified === 'true' ? 1 : 0);
  }

  // Filter theo approved status
  if (approved !== undefined) {
    sql += ' AND isApproved = ?';
    params.push(approved === 'true' ? 1 : 0);
  }

  // Pagination
  const offset = (page - 1) * limit;
  sql += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  db.query(sql, params, (err, results) => {
    if (err) {
      console.log('SQL Error:', err);
      return res.status(500).json({ error: err });
    }

    // �?m t?ng s? users d? t�nh pagination
    let countSql = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
    const countParams = [];

    if (role) {
      countSql += ' AND role = ?';
      countParams.push(role);
    }
    if (verified !== undefined) {
      countSql += ' AND isVerified = ?';
      countParams.push(verified === 'true' ? 1 : 0);
    }
    if (approved !== undefined) {
      countSql += ' AND isApproved = ?';
      countParams.push(approved === 'true' ? 1 : 0);
    }

    db.query(countSql, countParams, (err, countResults) => {
      if (err) {
        console.log('Count SQL Error:', err);
        return res.status(500).json({ error: err });
      }

      const total = countResults[0].total;
      const totalPages = Math.ceil(total / limit);

      res.json({
        users: results,
        pagination: {
          currentPage: parseInt(page),
          totalPages: totalPages,
          totalUsers: total,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });
    });
  });
});

// API: L?y th�ng tin user theo id
app.get('/api/users/:id', (req, res) => {
  db.query('SELECT * FROM users WHERE id = ?', [req.params.id], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    if (results.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(results[0]);
  });
});

// API: L?y profile d?y d? c?a user
app.get('/api/users/:id/profile', (req, res) => {
  db.query('SELECT * FROM users WHERE id = ?', [req.params.id], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    if (results.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(results[0]);
  });
});

// API: C?p nh?t profile user
app.put('/api/users/:id/profile', (req, res) => {
  const userId = req.params.id;

  console.log('=== UPDATE USER PROFILE ===');
  console.log('User ID:', userId);
  console.log('Request Body:', req.body);

  const allowedFields = [
    'fullName',
    'phone',
    'dateOfBirth',
    'gender',
    'address',
    'city',
    'district',
    'bio',
    'languages',
    'emergencyContact',
    'emergencyContactName',
    'avatar',
    'idCardFront',
    'idCardBack'
  ];

  const updates = [];
  const params = [];
  const nullableEmptyFields = new Set([
    'dateOfBirth',
    'gender',
    'city',
    'district',
    'languages',
    'emergencyContact',
    'emergencyContactName',
  ]);

  allowedFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      const value = req.body[field];
      updates.push(`${field} = ?`);
      params.push(value === undefined || (nullableEmptyFields.has(field) && value === '') ? null : value);
    }
  });

  if (updates.length === 0) {
    return res.status(400).json({ error: 'Kh�ng c� th�ng tin c?n c?p nh?t' });
  }

  updates.push('updatedAt = NOW()');
  const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
  params.push(userId);

  console.log('SQL:', sql);
  console.log('Params:', params);

  db.query(sql, params, (err, result) => {
    if (err) {
      console.error('SQL Error:', err);
      return res.status(500).json({ error: err });
    }
    
    console.log('Update Result:', result);
    console.log('Affected Rows:', result.affectedRows);
    
    if (result.affectedRows === 0) {
      console.log('No rows affected - User not found');
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Tr? v? th�ng tin user d� c?p nh?t
    db.query('SELECT * FROM users WHERE id = ?', [userId], (err, results) => {
      if (err) {
        console.error('Select Error:', err);
        return res.status(500).json({ error: err });
      }
      console.log('Updated User:', results[0]);
      res.json(results[0]);
    });
  });
});

// API: L?y profile housekeeper
app.get('/api/housekeepers/:userId/profile', (req, res) => {
  const userId = req.params.userId;
  
  const sql = `
    SELECT h.*, u.fullName, u.email, u.phone, u.avatar, u.isVerified, u.isApproved
    FROM housekeepers h
    JOIN users u ON h.userId = u.id
    WHERE h.userId = ?
  `;
  
  db.query(sql, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    if (results.length === 0) return res.status(404).json({ error: 'Housekeeper not found' });
    res.json(results[0]);
  });
});

// API: C?p nh?t profile housekeeper
app.put('/api/housekeepers/:userId/profile', (req, res) => {
  const userId = req.params.userId;
  const allowedFields = ['description', 'experience', 'price', 'priceType', 'workingHours', 'serviceRadius', 'services', 'available'];
  const updates = [];
  const params = [];

  allowedFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      updates.push(`${field} = ?`);
      params.push(req.body[field]);
    }
  });

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No housekeeper profile fields to update' });
  }

  updates.push('updatedAt = NOW()');
  const sql = `UPDATE housekeepers SET ${updates.join(', ')} WHERE userId = ?`;
  params.push(userId);

  db.query(sql, params, (err, result) => {
    if (err) return res.status(500).json({ error: err });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Housekeeper not found' });
    
    // Tr? v? th�ng tin housekeeper d� c?p nh?t
    const selectSql = `
      SELECT h.*, u.fullName, u.email, u.phone, u.avatar, u.isVerified, u.isApproved
      FROM housekeepers h
      JOIN users u ON h.userId = u.id
      WHERE h.userId = ?
    `;
    
    db.query(selectSql, [userId], (err, results) => {
      if (err) return res.status(500).json({ error: err });
      res.json(results[0]);
    });
  });
});

// API: L?y danh s�ch t?t c? bookings (cho Admin Dashboard)
app.get('/api/bookings', (req, res) => {
  const { status, housekeeper, customer, date, month, year, page = 1, limit = 50 } = req.query;
  
  let sql = `
    SELECT b.*, 
           u1.fullName as customerName, u1.email as customerEmail,
           u2.fullName as housekeeperName, u2.email as housekeeperEmail,
           s.name as serviceName
    FROM bookings b
    LEFT JOIN users u1 ON b.customerId = u1.id
    LEFT JOIN housekeepers hk_b ON b.housekeeperId = hk_b.id
    LEFT JOIN users u2 ON hk_b.userId = u2.id
    LEFT JOIN services s ON b.serviceId = s.id
    WHERE 1=1
  `;
  const params = [];

  // Filter theo status
  if (status) {
    sql += ' AND b.status = ?';
    params.push(status);
  }

  // Filter theo housekeeper
  if (housekeeper) {
    sql += ' AND b.housekeeperId = ?';
    params.push(housekeeper);
  }

  // Filter theo customer
  if (customer) {
    sql += ' AND b.customerId = ?';
    params.push(customer);
  }

  // Filter theo date
  if (date) {
    sql += ' AND DATE(b.startDate) = ?';
    params.push(date);
  }

  // Filter theo month/year
  if (month && year) {
    sql += ' AND MONTH(b.startDate) = ? AND YEAR(b.startDate) = ?';
    params.push(month, year);
  } else if (year) {
    sql += ' AND YEAR(b.startDate) = ?';
    params.push(year);
  }

  // Pagination
  const offset = (page - 1) * limit;
  sql += ' ORDER BY b.createdAt DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  db.query(sql, params, (err, results) => {
    if (err) {
      console.log('SQL Error:', err);
      return res.status(500).json({ error: err });
    }

    // �?m t?ng s? bookings d? t�nh pagination
    let countSql = 'SELECT COUNT(*) as total FROM bookings b WHERE 1=1';
    const countParams = [];

    if (status) {
      countSql += ' AND b.status = ?';
      countParams.push(status);
    }
    if (housekeeper) {
      countSql += ' AND b.housekeeperId = ?';
      countParams.push(housekeeper);
    }
    if (customer) {
      countSql += ' AND b.customerId = ?';
      countParams.push(customer);
    }
    if (date) {
      countSql += ' AND DATE(b.startDate) = ?';
      countParams.push(date);
    }
    if (month && year) {
      countSql += ' AND MONTH(b.startDate) = ? AND YEAR(b.startDate) = ?';
      countParams.push(month, year);
    } else if (year) {
      countSql += ' AND YEAR(b.startDate) = ?';
      countParams.push(year);
    }

    db.query(countSql, countParams, (err, countResults) => {
      if (err) {
        console.log('Count SQL Error:', err);
        return res.status(500).json({ error: err });
      }

      const total = countResults[0].total;
      const totalPages = Math.ceil(total / limit);

      res.json({
        bookings: results,
        pagination: {
          currentPage: parseInt(page),
          totalPages: totalPages,
          totalBookings: total,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });
    });
  });
});

// API: Quick Booking - T�m housekeeper ph� h?p
app.post('/api/quick-booking/find-matches', (req, res) => {
  const { 
    service, 
    date, 
    time, 
    duration, 
    location, 
    maxPrice, 
    urgency,
    customerId 
  } = req.body;

  console.log('?? Quick booking search request:', {
    service, date, time, duration, location, maxPrice, urgency, customerId
  });

  // Build query to find matching housekeepers
  // S? d?ng c?t h.services tr?c ti?p thay v� JOIN v?i b?ng housekeeper_services
  let sql = `
    SELECT h.*, u.fullName, u.email, u.phone, u.isVerified, u.isApproved,
           COALESCE(AVG(r.rating), 4.0) as avgRating,
           COUNT(r.id) as reviewCount,
           h.services as services
    FROM housekeepers h
    JOIN users u ON h.userId = u.id
    LEFT JOIN reviews r ON h.id = r.housekeeperId
    WHERE u.isApproved = 1 AND u.isVerified = 1
      AND h.price <= ?
  `;

  const params = [maxPrice];

  // Add service filter if specified - t�m trong c?t h.services
  if (service) {
    sql += ` AND h.services LIKE ?`;
    params.push(`%${service}%`);
  }

  sql += `
    GROUP BY h.id, u.id
    HAVING COALESCE(AVG(r.rating), 4.0) >= 3.0
    ORDER BY 
      CASE 
        WHEN ? = 'asap' THEN (COALESCE(AVG(r.rating), 4.0) * 0.3 + (5 - h.price/20) * 0.4 + COUNT(r.id)/10 * 0.3)
        WHEN ? = 'urgent' THEN (COALESCE(AVG(r.rating), 4.0) * 0.4 + (5 - h.price/20) * 0.3 + COUNT(r.id)/10 * 0.3)
        ELSE (COALESCE(AVG(r.rating), 4.0) * 0.5 + (5 - h.price/20) * 0.2 + COUNT(r.id)/10 * 0.3)
      END DESC
    LIMIT 10
  `;

  params.push(urgency, urgency);

  console.log('?? SQL Query:', sql);
  console.log('?? Params:', params);

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error('Error finding matching housekeepers:', err);
      console.error('SQL was:', sql);
      console.error('Params were:', params);
      return res.status(500).json({ error: 'Failed to find matches' });
    }

    console.log(`? Found ${results.length} matching housekeepers`);
    if (results.length > 0) {
      console.log('First match:', results[0].fullName, '- Services:', results[0].services);
    }
    
    // Calculate match scores and format results
    const matchedHousekeepers = results.map((hk, index) => {
      let matchScore = 85 - (index * 5); // Base score decreasing by rank
      
      // Adjust score based on criteria
      if (hk.avgRating >= 4.5) matchScore += 10;
      if (hk.reviewCount >= 10) matchScore += 5;
      if (hk.backgroundChecked) matchScore += 5;
      if (hk.insured) matchScore += 5;
      
      // Price bonus (lower price = higher score within budget)
      const priceRatio = hk.price / maxPrice;
      if (priceRatio <= 0.7) matchScore += 10;
      else if (priceRatio <= 0.9) matchScore += 5;

      return {
        ...hk,
        matchScore: Math.min(100, Math.max(60, matchScore)),
        services: hk.services ? hk.services.split(',') : []
      };
    });

    res.json({
      success: true,
      matches: matchedHousekeepers,
      searchCriteria: {
        service, date, time, duration, location, maxPrice, urgency
      }
    });
  });
});

// API: Quick Booking - T?o booking nhanh
app.post('/api/quick-booking/create', (req, res) => {
  const { 
    customerId,
    housekeeperId,
    service,
    date,
    time,
    duration,
    location,
    notes,
    totalPrice,
    customerName,
    customerEmail,
    customerPhone,
    housekeeperName,
    urgency,
    isQuickBooking = true
  } = req.body;

  console.log('? Creating quick booking:', {
    customerId, housekeeperId, service, date, time, urgency
  });

  const bookingData = {
    customerId,
    housekeeperId,
    service,
    date,
    time,
    duration,
    location,
    notes,
    status: 'pending',
    totalPrice,
    customerName,
    customerEmail,
    customerPhone,
    housekeeperName,
    urgency,
    isQuickBooking,
    createdAt: new Date()
  };

  const sql = `INSERT INTO bookings 
    (customerId, housekeeperId, service, startDate, time, duration, location, notes, status, totalPrice, customerName, customerEmail, customerPhone, housekeeperName, urgency, isQuickBooking, createdAt) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
  const values = [
    customerId, housekeeperId, service, date, time, duration, location, notes, 
    'pending', totalPrice, customerName, customerEmail, customerPhone, housekeeperName, urgency, isQuickBooking, new Date()
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error('Error creating quick booking:', err);
      return res.status(500).json({ error: err });
    }

    const bookingId = result.insertId;
    const newBooking = { ...bookingData, id: bookingId };
    const breakdown = paymentBreakdown(totalPrice);
    db.query(
      `INSERT INTO payments (bookingId, customerId, method, amount, platformFee, housekeeperAmount, settlementStatus, platformAccount, status, createdAt)` +
        ` VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
      [bookingId, customerId, normalizedPaymentMethod, breakdown.amount, breakdown.platformFee, breakdown.housekeeperAmount, 'pending', PLATFORM_PAYMENT_ACCOUNT],
      (paymentErr) => {
        if (paymentErr) console.error('Error creating pending payment record:', paymentErr);
      }
    );

    console.log('? QUICK BOOKING CREATED:');
    console.log('- Booking ID:', bookingId);
    console.log('- Customer ID:', customerId);
    console.log('- Housekeeper ID:', housekeeperId);
    console.log('- Urgency:', urgency);
    console.log('- Service:', service);

    // Send urgent notification to housekeeper for quick bookings
    const notificationTitle = urgency === 'asap' 
      ? '?? �on d?t l?ch KH?N C?P!' 
      : urgency === 'urgent' 
        ? '? �on d?t l?ch G?P!'
        : '?? �on d?t l?ch nhanh m?i';

    const notificationMessage = urgency === 'asap'
      ? `${customerName} c?n d?ch v? ${service} NGAY L?P T?C!`
      : urgency === 'urgent'
        ? `${customerName} c?n d?ch v? ${service} trong 6h t?i`
        : `${customerName} d� d?t l?ch d?ch v? ${service} (�?t nhanh)`;

    const notificationToHousekeeper = {
      id: Date.now(),
      type: 'quick_booking',
      title: notificationTitle,
      message: notificationMessage,
      bookingId: bookingId,
      booking: newBooking,
      urgency: urgency,
      timestamp: new Date(),
      read: false
    };

    // Get housekeeper's userId and send notification
    db.query('SELECT userId FROM housekeepers WHERE id = ?', [housekeeperId], (err, housekeeperResults) => {
      if (err || housekeeperResults.length === 0) {
        console.error('Error finding housekeeper userId:', err);
        return res.json({ success: true, booking: newBooking, id: bookingId });
      }

      const housekeeperUserId = housekeeperResults[0].userId;
      console.log('?? Sending quick booking notification to housekeeper userId:', housekeeperUserId);

      // Store notification in database (c?t read_status, kh�ng d�ng isRead)
      const notificationSql = `INSERT INTO notifications 
        (userId, type, title, message, bookingId, urgency, data, createdAt, read_status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      const notificationValues = [
        housekeeperUserId,
        'quick_booking',
        notificationTitle,
        notificationMessage,
        bookingId,
        urgency,
        JSON.stringify(newBooking),
        new Date(),
        0
      ];

      db.query(notificationSql, notificationValues, (err, notificationResult) => {
        if (err) {
          console.error('Error saving notification:', err);
          return res.json({ success: true, booking: newBooking, id: bookingId });
        }
        console.log('? Quick booking notification saved to database');

        if (io) {
          sendNotificationToUser(housekeeperUserId, {
            ...notificationToHousekeeper,
            id: notificationResult?.insertId || notificationToHousekeeper.id,
            userId: housekeeperUserId
          });
          console.log('?? Quick booking notification sent via WebSocket');
        }

        res.json({ success: true, booking: newBooking, id: bookingId });
      });
    });
  });
});

// API: �?t l?ch (Regular booking)
app.post('/api/bookings', (req, res) => {
  const { 
    customerId, 
    housekeeperId, 
    service, 
    date, 
    time,
    duration,
    location,
    notes,
    totalPrice,
    customerName,
    customerEmail,
    customerPhone,
    housekeeperName,
    paymentMethod
  } = req.body;
  const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);
  
  const bookingData = {
    customerId,
    housekeeperId,
    service,
    date,
    time,
    duration,
    location,
    notes,
    status: 'pending',
    totalPrice,
    customerName,
    customerEmail,
    customerPhone,
    housekeeperName,
    paymentMethod: normalizedPaymentMethod,
    createdAt: new Date()
  };

  const sql = `INSERT INTO bookings 
    (customerId, housekeeperId, service, startDate, time, duration, location, notes, status, totalPrice, customerName, customerEmail, customerPhone, housekeeperName, createdAt) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
  const values = [
    customerId, housekeeperId, service, date, time, duration, location, notes, 
    'pending', totalPrice, customerName, customerEmail, customerPhone, housekeeperName, new Date()
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error('Error creating booking:', err);
      return res.status(500).json({ error: err });
    }

    const bookingId = result.insertId;
    const newBooking = { ...bookingData, id: bookingId };
    const breakdown = paymentBreakdown(totalPrice);
    db.query(
      `INSERT INTO payments (bookingId, customerId, method, amount, platformFee, housekeeperAmount, settlementStatus, platformAccount, status, createdAt)` +
        ` VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
      [bookingId, customerId, normalizedPaymentMethod, breakdown.amount, breakdown.platformFee, breakdown.housekeeperAmount, 'pending', PLATFORM_PAYMENT_ACCOUNT],
      (paymentErr) => {
        if (paymentErr) console.error('Error creating pending payment record:', paymentErr);
      }
    );

    console.log('?? NEW BOOKING CREATED:');
    console.log('- Booking ID:', bookingId);
    console.log('- Customer ID:', customerId);
    console.log('- Housekeeper ID:', housekeeperId);
    console.log('- Customer Name:', customerName);
    console.log('- Service:', service);

    // Send notification to housekeeper
    const notificationToHousekeeper = {
      id: Date.now(),
      type: 'new_booking',
      title: 'Don dat lich moi',
      message: `${customerName} da dat lich dich vu ${service}`,
      bookingId: bookingId,
      booking: newBooking,
      timestamp: new Date(),
      read: false
    };

    // Get housekeeper's userId from housekeeperId
    console.log('?? Looking up housekeeper userId for housekeeperId:', housekeeperId);
    db.query('SELECT userId FROM housekeepers WHERE id = ?', [housekeeperId], (err, hkResults) => {
      console.log('?? Housekeeper query results:', hkResults);
      
      if (!err && hkResults.length > 0) {
        const housekeeperUserId = hkResults[0].userId;
        console.log('? Found housekeeper userId:', housekeeperUserId);
        console.log('?? Sending notification to userId:', housekeeperUserId);
        
        // Save notification to database
        const notifSql = `INSERT INTO notifications (userId, type, title, message, bookingId, data, createdAt, read_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        db.query(notifSql, [
          housekeeperUserId, 
          notificationToHousekeeper.type,
          notificationToHousekeeper.title,
          notificationToHousekeeper.message,
          bookingId,
          JSON.stringify(newBooking),
          new Date(),
          0
        ], (notifErr, notifResult) => {
          if (notifErr) {
            console.error('Error saving notification:', notifErr);
            return;
          }
          const sent = sendNotificationToUser(housekeeperUserId, {
            ...notificationToHousekeeper,
            id: notifResult?.insertId || notificationToHousekeeper.id,
            userId: housekeeperUserId
          });
          console.log('Notification sent after save:', sent);
        });

        // Kh�ng t? t?o tin nh?n thay housekeeper; housekeeper s? ph?n h?i sau khi xem/nh?n don.
      }
    });

    res.json(newBooking);
  });
});

// API: Customer huy booking dang cho xac nhan
app.post('/api/bookings/:id/cancel', (req, res) => {
  const bookingId = req.params.id;

  db.query('SELECT * FROM bookings WHERE id = ?', [bookingId], (selectErr, rows) => {
    if (selectErr) {
      console.error('Error loading booking for cancel:', selectErr);
      return res.status(500).json({ error: selectErr.message });
    }

    if (!rows.length) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = rows[0];
    if (!sameUser(booking.customerId, req.user.id)) {
      return res.status(403).json({ error: 'Ban chi co the huy booking cua chinh minh' });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({ error: 'Chi co the huy booking dang cho xac nhan' });
    }

    db.query(
      'UPDATE bookings SET status = ?, updatedAt = NOW() WHERE id = ? AND customerId = ? AND status = ?',
      ['cancelled', bookingId, req.user.id, 'pending'],
      (updateErr, result) => {
        if (updateErr) {
          console.error('Error cancelling booking:', updateErr);
          return res.status(500).json({ error: updateErr.message });
        }

        if (result.affectedRows === 0) {
          return res.status(400).json({ error: 'Booking khong the huy' });
        }

        db.query('SELECT * FROM bookings WHERE id = ?', [bookingId], (reloadErr, bookingRows) => {
          if (reloadErr || !bookingRows.length) {
            return res.status(500).json({ error: 'Error fetching cancelled booking' });
          }

          const cancelledBooking = bookingRows[0];
          db.query('SELECT userId FROM housekeepers WHERE id = ?', [cancelledBooking.housekeeperId], (hkErr, hkRows) => {
            if (!hkErr && hkRows.length) {
              const housekeeperUserId = hkRows[0].userId;
              const title = 'Booking da bi huy';
              const message = `${cancelledBooking.customerName || 'Khach hang'} da huy booking ${cancelledBooking.service || ''}`.trim();
              const notifSql = 'INSERT INTO notifications (userId, type, title, message, bookingId, data, createdAt, read_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
              db.query(notifSql, [
                housekeeperUserId,
                'booking_cancelled',
                title,
                message,
                bookingId,
                JSON.stringify(cancelledBooking),
                new Date(),
                0,
              ], (notifErr, notifResult) => {
                if (notifErr) {
                  console.error('Error saving cancel notification:', notifErr);
                  return;
                }

                sendNotificationToUser(housekeeperUserId, {
                  id: notifResult?.insertId || Date.now(),
                  userId: housekeeperUserId,
                  type: 'booking_cancelled',
                  title,
                  message,
                  bookingId,
                  booking: cancelledBooking,
                  timestamp: new Date(),
                  read: false,
                });
              });
            }
          });

          res.json({ message: 'Booking cancelled successfully', booking: cancelledBooking });
        });
      }
    );
  });
});
// API: Housekeeper x�c nh?n booking
app.post('/api/bookings/:id/confirm', (req, res) => {
  const bookingId = req.params.id;
  const { housekeeperId } = req.body; // L?y housekeeperId t? request body
  
  // Ki?m tra tr?ng th�i x�c minh v� ph� duy?t c?a housekeeper tru?c khi cho ph�p x�c nh?n
  db.query(
    `SELECT u.id AS housekeeperUserId, u.isVerified, u.isApproved
     FROM bookings b
     JOIN housekeepers h ON b.housekeeperId = h.id
     JOIN users u ON h.userId = u.id
     WHERE b.id = ?`,
    [bookingId],
    (verifyErr, verifyResults) => {
    if (verifyErr) {
      console.error('Error checking housekeeper verification:', verifyErr);
      return res.status(500).json({ error: 'L?i ki?m tra tr?ng th�i x�c minh' });
    }
    
    if (verifyResults.length === 0) {
      return res.status(404).json({ error: 'Kh�ng t�m th?y booking' });
    }
    
    const housekeeper = verifyResults[0];
    if (!sameUser(housekeeper.housekeeperUserId, req.user.id)) {
      return res.status(403).json({ error: 'B?n ch? c� th? x�c nh?n booking c?a ch�nh m�nh' });
    }

    if (!housekeeper.isVerified || !housekeeper.isApproved) {
      return res.status(403).json({ 
        error: 'B?n c?n du?c x�c minh v� ph� duy?t b?i admin tru?c khi c� th? x�c nh?n booking',
        needsVerification: !housekeeper.isVerified,
        needsApproval: !housekeeper.isApproved
      });
    }
    
    // Update booking status to confirmed
    db.query('UPDATE bookings SET status = ? WHERE id = ?', ['confirmed', bookingId], (err, result) => {
    if (err) {
      console.error('Error confirming booking:', err);
      return res.status(500).json({ error: err });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Get booking details to send notification to customer
    db.query('SELECT * FROM bookings WHERE id = ?', [bookingId], (err, bookingResults) => {
      if (err || bookingResults.length === 0) {
        return res.status(500).json({ error: 'Error fetching booking details' });
      }

      const booking = bookingResults[0];
      
      // Send notification to customer
      const notificationToCustomer = {
        id: Date.now(),
        type: 'booking_confirmed',
        title: '�?t l?ch d� du?c x�c nh?n',
        message: `${booking.housekeeperName} d� x�c nh?n don d?t l?ch c?a b?n`,
        bookingId: bookingId,
        booking: booking,
        timestamp: new Date(),
        read: false
      };

      console.log('?? Sending confirmation notification to customer:', booking.customerId);
      console.log('Notification data:', notificationToCustomer);
      
      // Save notification to database
      const notifSql = `INSERT INTO notifications (userId, type, title, message, bookingId, data, createdAt, read_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
      db.query(notifSql, [
        booking.customerId,
        notificationToCustomer.type,
        notificationToCustomer.title,
        notificationToCustomer.message,
        bookingId,
        JSON.stringify(booking),
        new Date(),
        0
      ], (notifErr, notifResult) => {
        if (notifErr) {
          console.error('Error saving notification:', notifErr);
          return;
        }
        const sent = sendNotificationToUser(booking.customerId, {
          ...notificationToCustomer,
          id: notifResult?.insertId || notificationToCustomer.id,
          userId: booking.customerId
        });
        console.log('Notification sent successfully:', sent);
      });

      res.json({ message: 'Booking confirmed successfully', booking: booking });
    });
  });
  });
});

// API: Housekeeper t? ch?i booking
app.post('/api/bookings/:id/reject', (req, res) => {
  const bookingId = req.params.id;
  
  // Update booking status to rejected, scoped to the authenticated housekeeper.
  db.query(
    `UPDATE bookings b
     JOIN housekeepers h ON b.housekeeperId = h.id
     SET b.status = ?, b.updatedAt = NOW()
     WHERE b.id = ? AND h.userId = ?`,
    ['rejected', bookingId, req.user.id],
    (err, result) => {
    if (err) {
      console.error('Error rejecting booking:', err);
      return res.status(500).json({ error: err });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Booking not found or unauthorized' });
    }

    // Get booking details to send notification to customer
    db.query('SELECT * FROM bookings WHERE id = ?', [bookingId], (err, bookingResults) => {
      if (err || bookingResults.length === 0) {
        return res.status(500).json({ error: 'Error fetching booking details' });
      }

      const booking = bookingResults[0];
      
      // Send notification to customer
      const notificationToCustomer = {
        id: Date.now(),
        type: 'booking_rejected',
        title: '�?t l?ch d� b? t? ch?i',
        message: `${booking.housekeeperName} d� t? ch?i don d?t l?ch c?a b?n`,
        bookingId: bookingId,
        booking: booking,
        timestamp: new Date(),
        read: false
      };

      console.log('? Sending rejection notification to customer:', booking.customerId);
      console.log('Notification data:', notificationToCustomer);
      
      // Save notification to database
      const notifSql = `INSERT INTO notifications (userId, type, title, message, bookingId, data, createdAt, read_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
      db.query(notifSql, [
        booking.customerId,
        notificationToCustomer.type,
        notificationToCustomer.title,
        notificationToCustomer.message,
        bookingId,
        JSON.stringify(booking),
        new Date(),
        0
      ], (notifErr, notifResult) => {
        if (notifErr) {
          console.error('Error saving notification:', notifErr);
          return;
        }
        const sent = sendNotificationToUser(booking.customerId, {
          ...notificationToCustomer,
          id: notifResult?.insertId || notificationToCustomer.id,
          userId: booking.customerId
        });
        console.log('Notification sent successfully:', sent);
      });

      res.json({ message: 'Booking rejected successfully', booking: booking });
    });
  });
});

// API: Ki?m tra status c?a booking
app.get('/api/bookings/:id/status', (req, res) => {
  const bookingId = req.params.id;
  
  db.query('SELECT id, status FROM bookings WHERE id = ?', [bookingId], (err, results) => {
    if (err) {
      console.error('Error fetching booking status:', err);
      return res.status(500).json({ error: err });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    res.json(results[0]);
  });
});

// API: L?y l?ch s? d?t l?ch c?a user
app.get('/api/bookings/user/:id', (req, res) => {
  const userId = req.params.id;
  
  // T�m housekeepers.id tuong ?ng v?i users.id (d? h? tr? c? 2 tru?ng h?p)
  const sql = `
    SELECT b.*,
      (SELECT p.method FROM payments p WHERE p.bookingId = b.id ORDER BY p.createdAt DESC LIMIT 1) as paymentMethod,
      (SELECT p.settlementStatus FROM payments p WHERE p.bookingId = b.id ORDER BY p.createdAt DESC LIMIT 1) as settlementStatus,
      (SELECT p.platformFee FROM payments p WHERE p.bookingId = b.id ORDER BY p.createdAt DESC LIMIT 1) as platformFee,
      (SELECT p.housekeeperAmount FROM payments p WHERE p.bookingId = b.id ORDER BY p.createdAt DESC LIMIT 1) as housekeeperAmount
    FROM bookings b
    WHERE b.customerId = ?
    OR b.housekeeperId IN (SELECT h.id FROM housekeepers h WHERE h.userId = ?)
  `;

  db.query(sql, [userId, userId], (err, results) => {
    if (err) {
      console.error('Error fetching bookings for user:', err);
      return res.status(500).json({ error: err });
    }
    console.log(`?? Found ${results.length} bookings for user ${userId}`);
    res.json(results);
  });
});

// API: T?o review cho housekeeper
app.post('/api/reviews', (req, res) => {
  const { housekeeperId, customerId, rating, comment } = req.body;
  const sql = 'INSERT INTO reviews (housekeeperId, customerId, rating, comment) VALUES (?, ?, ?, ?)';
  db.query(sql, [housekeeperId, customerId, rating, comment], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ id: result.insertId, housekeeperId, customerId, rating, comment });
  });
});

// API: L?y reviews c?a housekeeper
app.get('/api/reviews/housekeeper/:id', (req, res) => {
  const housekeeperId = req.params.id;
  const sql = `
    SELECT r.*, u.fullName as customerName
    FROM reviews r
    JOIN users u ON r.customerId = u.id
    WHERE r.housekeeperId = ?
    ORDER BY r.createdAt DESC
  `;
  db.query(sql, [housekeeperId], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
});

// API: Filter - Services (l?y t? b?ng services)
app.get('/api/filters/services', (req, res) => {
  db.query('SELECT name FROM services', (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results.map(r => r.name));
  });
});

// API: Filter - Ratings (tr? v? t?t c? c�c l?a ch?n t? 1-5 sao)
app.get('/api/filters/ratings', (req, res) => {
  // Tr? v? t?t c? c�c l?a ch?n rating t? 1-5 sao, bao g?m "Any rating"
  const ratings = [
    { value: null, label: "Any rating", stars: 5 },
    { value: 5, label: "5 stars", stars: 5 },
    { value: 4, label: "4 stars", stars: 4 },
    { value: 3, label: "3 stars", stars: 3 },
    { value: 2, label: "2 stars", stars: 2 },
    { value: 1, label: "1 star", stars: 1 }
  ];
  res.json(ratings);
});

// API: Filter - Price Range
app.get('/api/filters/price-range', (req, res) => {
  db.query('SELECT MIN(price) AS min_price, MAX(price) AS max_price FROM housekeepers', (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results[0]);
  });
});

// API: Filter - Availability
app.get('/api/filters/availability', (req, res) => {
  db.query('SELECT DISTINCT available FROM housekeepers', (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results.map(r => r.available));
  });
});

// API: L?y notifications c?a user
app.get('/api/notifications/:userId', (req, res) => {
  const userId = req.params.userId;
  
  db.query(
    'SELECT * FROM notifications WHERE userId = ? ORDER BY createdAt DESC LIMIT 50',
    [userId],
    (err, results) => {
      if (err) {
        console.error('Error fetching notifications:', err);
        return res.status(500).json({ error: err });
      }
      
      const parseNotifData = (raw) => {
        if (raw == null || raw === '') return null;
        if (typeof raw === 'object') return raw; // mysql2 d� parse c?t JSON
        if (typeof raw === 'string') {
          try {
            return JSON.parse(raw);
          } catch {
            return raw;
          }
        }
        return raw;
      };

      const notifications = results.map((notif) => ({
        ...notif,
        data: parseNotifData(notif.data),
        read: notif.read_status === 1
      }));
      
      res.json(notifications);
    }
  );
});

// API: T?o notification m?i
app.post('/api/notifications', (req, res) => {
  const { userId, type, title, message, bookingId, data } = req.body;
  
  if (!userId || !type || !title || !message) {
    return res.status(400).json({ error: 'Missing required fields: userId, type, title, message' });
  }
  
  const sql = `INSERT INTO notifications (userId, type, title, message, bookingId, data, createdAt, read_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  const values = [
    userId,
    type,
    title,
    message,
    bookingId || null,
    data ? JSON.stringify(data) : null,
    new Date(),
    0
  ];
  
  db.query(sql, values, (err, result) => {
    if (err) {
      console.error('Error creating notification:', err);
      return res.status(500).json({ error: err });
    }
    
    const notificationId = result.insertId;
    const newNotification = {
      id: notificationId,
      userId,
      type,
      title,
      message,
      bookingId,
      data,
      timestamp: new Date(),
      read: false
    };
    
    // Send notification via WebSocket
    sendNotificationToUser(userId, newNotification);
    
    res.json({ message: 'Notification created successfully', notification: newNotification });
  });
});

// API: ��nh d?u notification d� d?c
app.put('/api/notifications/:id/read', (req, res) => {
  const notificationId = req.params.id;
  const params = req.user?.role === 'admin'
    ? [notificationId]
    : [notificationId, req.user.id];
  const sql = req.user?.role === 'admin'
    ? 'UPDATE notifications SET read_status = 1 WHERE id = ?'
    : 'UPDATE notifications SET read_status = 1 WHERE id = ? AND userId = ?';
  
  db.query(
    sql,
    params,
    (err, result) => {
      if (err) {
        console.error('Error marking notification as read:', err);
        return res.status(500).json({ error: err });
      }
      
      res.json({ message: 'Notification marked as read' });
    }
  );
});

// API: X�a notification
app.delete('/api/notifications/:id', (req, res) => {
  const notificationId = req.params.id;
  const params = req.user?.role === 'admin'
    ? [notificationId]
    : [notificationId, req.user.id];
  const sql = req.user?.role === 'admin'
    ? 'DELETE FROM notifications WHERE id = ?'
    : 'DELETE FROM notifications WHERE id = ? AND userId = ?';
  
  db.query(
    sql,
    params,
    (err, result) => {
      if (err) {
        console.error('Error deleting notification:', err);
        return res.status(500).json({ error: err });
      }
      
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Notification not found' });
      }
      
      res.json({ message: 'Notification deleted successfully' });
    }
  );
});

// WebSocket connection handling
const activeUsers = new Map(); // Store active user connections

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // User joins with their ID and role
  socket.on('join', ({ userId, role, userName }) => {
    // Store user with both string and number keys to handle type mismatches
    const userIdStr = String(userId);
    const userIdNum = parseInt(userId);
    
    const userInfo = { socketId: socket.id, role, userId: userId, userName };
    socket.join('user:' + userIdStr);
    activeUsers.set(userId, userInfo);
    activeUsers.set(userIdStr, userInfo);
    activeUsers.set(userIdNum, userInfo);
    
    socket.userId = userId;
    socket.role = role;
    socket.userName = userName;
    
    // C?p nh?t tr?ng th�i available cho housekeeper khi dang nh?p
    if (role === 'housekeeper') {
      db.query('UPDATE housekeepers SET lastOnline = NOW() WHERE userId = ?', [userId], (err) => {
        if (err) {
          console.error('Error updating housekeeper lastOnline:', err);
        } else {
          console.log(`Housekeeper ${userId} socket joined; receive-jobs status unchanged`);
        }
      });
    }
    
    console.log(`? User ${userId} (${role}) joined. Active users: ${activeUsers.size}`);
    console.log(`Stored user with keys:`, [userId, userIdStr, userIdNum]);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    if (socket.userId) {
      const userIdStr = String(socket.userId);
      const userIdNum = parseInt(socket.userId);
      
      // C?p nh?t tr?ng th�i available cho housekeeper khi dang xu?t
      if (socket.role === 'housekeeper') {
        db.query('UPDATE housekeepers SET lastOnline = NOW() WHERE userId = ?', [socket.userId], (err) => {
          if (err) {
            console.error('Error updating housekeeper lastOnline:', err);
          } else {
            console.log(`Housekeeper ${socket.userId} socket disconnected; receive-jobs status unchanged`);
          }
        });
      }
      
      activeUsers.delete(socket.userId);
      activeUsers.delete(userIdStr);
      activeUsers.delete(userIdNum);
      
      console.log(`? User ${socket.userId} disconnected. Active users: ${activeUsers.size}`);
    }
  });

  // Call signaling handlers
  const findActiveUser = (targetUserId) => activeUsers.get(targetUserId) || activeUsers.get(String(targetUserId)) || activeUsers.get(parseInt(targetUserId));

  socket.on('call_invite', ({ targetUserId, roomName, callerName, bookingId, callType }) => {
    console.log(`Call invite from ${socket.userId} to ${targetUserId} in room ${roomName}`);

    const targetUser = findActiveUser(targetUserId);
    const targetRoom = 'user:' + String(targetUserId);
    const targetRoomSize = io.sockets.adapter.rooms.get(targetRoom)?.size || 0;

    if (!targetUser && targetRoomSize === 0) {
      socket.emit('call_failed', { error: 'User not available', roomName, bookingId });
      console.log(`Target user ${targetUserId} not found or offline`);
      return;
    }

    const callData = {
      bookingId,
      callerId: socket.userId,
      callerName: callerName || socket.userName || 'Nguoi dung',
      callType: callType || 'video',
      createdAt: new Date().toISOString(),
      roomName,
      targetUserId
    };

    io.to(targetRoom).emit('incoming_call', callData);
    if (targetUser?.socketId) {
      io.to(targetUser.socketId).emit('incoming_call', callData);
    }
    socket.emit('call_ringing', { bookingId, roomName, targetUserId });
    console.log(`Call invite sent to ${targetUserId}:`, callData);
  });

  socket.on('call_offer', ({ targetUserId, offer, isVideoCall, callerId }) => {
    console.log(`Call offer from ${callerId || socket.userId} to ${targetUserId}`);

    const actualCallerId = callerId || socket.userId;
    const targetUser = findActiveUser(targetUserId);

    if (targetUser) {
      const callData = {
        callerId: actualCallerId,
        callerName: socket.userName || 'Nguoi dung',
        offer,
        isVideoCall
      };

      io.to(targetUser.socketId).emit('incoming_call', callData);
      console.log(`Call offer sent to ${targetUserId}:`, callData);
    } else {
      socket.emit('call_failed', { error: 'User not available' });
      console.log(`Target user ${targetUserId} not found or offline`);
    }
  });

  socket.on('call_answer', ({ targetUserId, answer }) => {
    console.log(`Call answer from ${socket.userId} to ${targetUserId}`);

    const targetUser = findActiveUser(targetUserId);

    if (targetUser) {
      io.to(targetUser.socketId).emit('call_answer', { answer });
      console.log(`Call answer sent to ${targetUserId}`);
    }
  });

  socket.on('call_accepted', ({ targetUserId, roomName, bookingId }) => {
    console.log(`Call accepted by ${socket.userId} to ${targetUserId}`);

    const targetUser = findActiveUser(targetUserId);
    const targetRoom = 'user:' + String(targetUserId);
    const payload = { bookingId, roomName, userId: socket.userId };

    io.to(targetRoom).emit('call_accepted', payload);
    if (targetUser?.socketId) {
      io.to(targetUser.socketId).emit('call_accepted', payload);
    }
    console.log(`Call accepted sent to ${targetUserId}`);
  });

  socket.on('call_rejected', ({ targetUserId, roomName, bookingId }) => {
    console.log(`Call rejected by ${socket.userId} to ${targetUserId}`);

    const targetUser = findActiveUser(targetUserId);
    const targetRoom = 'user:' + String(targetUserId);
    const payload = { bookingId, roomName, userId: socket.userId };

    io.to(targetRoom).emit('call_rejected', payload);
    if (targetUser?.socketId) {
      io.to(targetUser.socketId).emit('call_rejected', payload);
    }
    console.log(`Call rejection sent to ${targetUserId}`);
  });
  socket.on('ice_candidate', ({ candidate, targetUserId }) => {
    const targetUser = activeUsers.get(targetUserId) || activeUsers.get(String(targetUserId)) || activeUsers.get(parseInt(targetUserId));
    
    if (targetUser) {
      io.to(targetUser.socketId).emit('ice_candidate', { candidate });
    }
  });

  socket.on('call_ended', ({ targetUserId }) => {
    console.log(`?? Call ended by ${socket.userId}`);
    
    if (targetUserId) {
      const targetUser = activeUsers.get(targetUserId) || activeUsers.get(String(targetUserId)) || activeUsers.get(parseInt(targetUserId));
      
      if (targetUser) {
        io.to(targetUser.socketId).emit('call_ended');
        console.log(`? Call end notification sent to ${targetUserId}`);
      }
    }
  });
});

// Helper function to send notification to specific user
function sendNotificationToUser(userId, notification) {
  console.log(`Trying to send notification to user ${userId}`, {
    userIdType: typeof userId,
    activeUsersKeys: Array.from(activeUsers.keys()),
    activeUsersSize: activeUsers.size
  });
  
  // Try both string and number versions of userId
  const userIdStr = String(userId);
  const userIdNum = parseInt(userId);
  
  let user = activeUsers.get(userId) || activeUsers.get(userIdStr) || activeUsers.get(userIdNum);
  
  if (user) {
    io.to(user.socketId).emit('notification', notification);
    console.log(`✅ Notification sent to user ${userId}:`, notification);
    return true;
  } else {
    console.log(`❌ User ${userId} not found in active users. Available users:`, Array.from(activeUsers.keys()));
    return false;
  }
}

function notifyUserAboutChatMessage(newMessage) {
  if (!newMessage || !newMessage.receiverId) return;

  const notification = {
    id: Date.now(),
    type: 'chat_message',
    title: 'Tin nhan moi',
    message: `${newMessage.senderName || 'Nguoi dung'}: ${newMessage.message}`,
    bookingId: newMessage.bookingId,
    senderId: newMessage.senderId,
    messageId: newMessage.id,
    timestamp: new Date(),
    read: false
  };

  const notifSql = `INSERT INTO notifications (userId, type, title, message, bookingId, data, createdAt, read_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  db.query(notifSql, [
    newMessage.receiverId,
    notification.type,
    notification.title,
    notification.message,
    newMessage.bookingId || null,
    JSON.stringify({ senderId: newMessage.senderId, receiverId: newMessage.receiverId, messageId: newMessage.id }),
    new Date(),
    0
  ], (notifErr, notifResult) => {
    if (notifErr) {
      console.error('Error saving chat notification:', notifErr);
      sendNotificationToUser(newMessage.receiverId, notification);
      return;
    }

    sendNotificationToUser(newMessage.receiverId, {
      ...notification,
      id: notifResult?.insertId || notification.id,
      userId: newMessage.receiverId
    });
  });
}

// API để debug active users
app.get('/api/debug/active-users', (req, res) => {
  const activeUsersList = Array.from(activeUsers.entries()).map(([key, value]) => ({
    key: key,
    keyType: typeof key,
    value: value
  }));
  
  res.json({
    totalActiveUsers: activeUsers.size,
    activeUsers: activeUsersList,
    uniqueSocketIds: [...new Set(Array.from(activeUsers.values()).map(u => u.socketId))].length
  });
});

// API để debug database structure
app.get('/api/debug/db-structure', (req, res) => {
  // Get columns of bookings table
  db.query('DESCRIBE bookings', (err, bookingsColumns) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to get bookings structure: ' + err.message });
    }
    
    // Get columns of users table
    db.query('DESCRIBE users', (err2, usersColumns) => {
      if (err2) {
        return res.status(500).json({ error: 'Failed to get users structure: ' + err2.message });
      }
      
      // Get sample booking data and notifications structure
      db.query('SELECT * FROM bookings LIMIT 3', (err3, sampleBookings) => {
        if (err3) {
          return res.status(500).json({ error: 'Failed to get sample bookings: ' + err3.message });
        }
        
        // Get notifications table structure
        db.query('DESCRIBE notifications', (err4, notificationsColumns) => {
          if (err4) {
            return res.status(500).json({ 
              bookingsStructure: bookingsColumns,
              usersStructure: usersColumns,
              sampleBookings: sampleBookings,
              notificationsError: 'Failed to get notifications structure: ' + err4.message
            });
          }
          
          // Get recent notifications
          db.query('SELECT * FROM notifications ORDER BY createdAt DESC LIMIT 5', (err5, recentNotifications) => {
            res.json({
              bookingsStructure: bookingsColumns,
              usersStructure: usersColumns,
              notificationsStructure: notificationsColumns,
              sampleBookings: sampleBookings,
              recentNotifications: recentNotifications || []
            });
          });
        });
      });
    });
  });
});

// API test để debug notification
app.post('/api/test-notification', (req, res) => {
  const { userId, message } = req.body;
  
  console.log(`🧪 Testing notification for user ${userId}`);
  
  const testNotification = {
    id: Date.now(),
    type: 'test',
    title: 'Test Notification',
    message: message || 'This is a test notification',
    timestamp: new Date(),
    read: false
  };
  
  const sent = sendNotificationToUser(userId, testNotification);
  
  res.json({ 
    success: sent, 
    message: sent ? 'Notification sent' : 'User not connected',
    activeUsers: Array.from(activeUsers.keys())
  });
});

// API để fix customer ID trong booking
app.put('/api/debug/fix-booking-customer/:bookingId', (req, res) => {
  const { bookingId } = req.params;
  const { newCustomerId } = req.body;
  
  console.log(`🔧 Fixing booking ${bookingId} customer ID to ${newCustomerId}`);
  
  const query = 'UPDATE bookings SET customerId = ? WHERE id = ?';
  db.query(query, [newCustomerId, bookingId], (err, result) => {
    if (err) {
      console.error('Error updating booking customer ID:', err);
      return res.status(500).json({ error: err.message });
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    console.log(`✅ Updated booking ${bookingId} customer ID to ${newCustomerId}`);
    res.json({ 
      message: 'Booking customer ID updated successfully',
      bookingId: bookingId,
      newCustomerId: newCustomerId,
      affectedRows: result.affectedRows
    });
  });
});

// ========================
// REPORTS API - Báo cáo vi phạm
// ========================

// API: Tạo báo cáo vi phạm
app.post('/api/reports', (req, res) => {
  const { 
    bookingId, 
    customerId, 
    housekeeperId, 
    reportType, 
    title, 
    description, 
    evidence, 
    severity 
  } = req.body;

  // Validate required fields
  if (!bookingId || !customerId || !housekeeperId || !reportType || !title || !description) {
    return res.status(400).json({ 
      error: 'Thiếu thông tin bắt buộc: bookingId, customerId, housekeeperId, reportType, title, description' 
    });
  }

  // Validate reportType
  const validReportTypes = ['late_arrival', 'no_show', 'inappropriate_behavior', 'poor_service', 'damage', 'other'];
  if (!validReportTypes.includes(reportType)) {
    return res.status(400).json({ 
      error: 'Loại báo cáo không hợp lệ. Phải là: ' + validReportTypes.join(', ') 
    });
  }

  // Validate severity
  const validSeverities = ['low', 'medium', 'high', 'critical'];
  if (severity && !validSeverities.includes(severity)) {
    return res.status(400).json({ 
      error: 'Mức độ nghiêm trọng không hợp lệ. Phải là: ' + validSeverities.join(', ') 
    });
  }

  const sql = `INSERT INTO reports 
    (bookingId, customerId, housekeeperId, reportType, title, description, evidence, severity, status, createdAt) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`;
    
  const values = [
    bookingId, 
    customerId, 
    housekeeperId, 
    reportType, 
    title, 
    description, 
    evidence || null, 
    severity || 'medium'
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error('Error creating report:', err);
      return res.status(500).json({ error: 'Lỗi tạo báo cáo: ' + err.message });
    }

    console.log(`✅ Report created with ID: ${result.insertId}`);
    
    // Tạo notification cho admin về báo cáo mới
    const adminNotificationSql = `INSERT INTO notifications 
      (userId, type, title, message, data, createdAt) 
      SELECT u.id, 'new_report', ?, ?, ?, NOW()
      FROM users u WHERE u.role = 'admin'`;
    
    const notificationData = JSON.stringify({
      reportId: result.insertId,
      bookingId: bookingId,
      reportType: reportType,
      severity: severity || 'medium'
    });

    db.query(adminNotificationSql, [
      'Báo cáo vi phạm mới',
      `Khách hàng đã báo cáo vi phạm: ${title}`,
      notificationData
    ], (notifErr) => {
      if (notifErr) {
        console.error('Error creating admin notification:', notifErr);
      } else {
        console.log('✅ Admin notification created for new report');
      }
    });

    res.status(201).json({
      message: 'Báo cáo đã được tạo thành công',
      reportId: result.insertId,
      status: 'pending'
    });
  });
});

// API: Lấy danh sách báo cáo của customer
app.get('/api/reports/customer/:customerId', (req, res) => {
  const { customerId } = req.params;
  const { status, page = 1, limit = 10 } = req.query;

  let sql = `
    SELECT r.*, 
           b.service, b.startDate, b.customerName, b.housekeeperName,
           u.fullName as housekeeperFullName, u.avatar as housekeeperAvatar
    FROM reports r
    LEFT JOIN bookings b ON r.bookingId = b.id
    LEFT JOIN users u ON r.housekeeperId = u.id
    WHERE r.customerId = ?
  `;
  const params = [customerId];

  // Filter theo status nếu có
  if (status) {
    sql += ' AND r.status = ?';
    params.push(status);
  }

  // Pagination
  const offset = (page - 1) * limit;
  sql += ' ORDER BY r.createdAt DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error('Error fetching customer reports:', err);
      return res.status(500).json({ error: 'Lỗi lấy danh sách báo cáo: ' + err.message });
    }

    // Get total count
    const countSql = `SELECT COUNT(*) as total FROM reports WHERE customerId = ?${status ? ' AND status = ?' : ''}`;
    const countParams = status ? [customerId, status] : [customerId];

    db.query(countSql, countParams, (countErr, countResults) => {
      if (countErr) {
        console.error('Error counting customer reports:', countErr);
        return res.status(500).json({ error: 'Lỗi đếm báo cáo: ' + countErr.message });
      }

      res.json({
        reports: results,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(countResults[0].total / limit),
          totalReports: countResults[0].total,
          limit: parseInt(limit)
        }
      });
    });
  });
});

// API: Lấy tất cả báo cáo (cho admin)
app.get('/api/reports', (req, res) => {
  const { status, reportType, severity, page = 1, limit = 20 } = req.query;

  let sql = `
    SELECT r.*, 
           b.service, b.startDate, b.customerName, b.housekeeperName,
           c.fullName as customerFullName, c.email as customerEmail,
           h.fullName as housekeeperFullName, h.email as housekeeperEmail
    FROM reports r
    LEFT JOIN bookings b ON r.bookingId = b.id
    LEFT JOIN users c ON r.customerId = c.id
    LEFT JOIN users h ON r.housekeeperId = h.id
    WHERE 1=1
  `;
  const params = [];

  // Filters
  if (status) {
    sql += ' AND r.status = ?';
    params.push(status);
  }

  if (reportType) {
    sql += ' AND r.reportType = ?';
    params.push(reportType);
  }

  if (severity) {
    sql += ' AND r.severity = ?';
    params.push(severity);
  }

  // Pagination
  const offset = (page - 1) * limit;
  sql += ' ORDER BY r.createdAt DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error('Error fetching all reports:', err);
      return res.status(500).json({ error: 'Lỗi lấy danh sách báo cáo: ' + err.message });
    }

    // Get total count
    let countSql = 'SELECT COUNT(*) as total FROM reports WHERE 1=1';
    const countParams = [];

    if (status) {
      countSql += ' AND status = ?';
      countParams.push(status);
    }
    if (reportType) {
      countSql += ' AND reportType = ?';
      countParams.push(reportType);
    }
    if (severity) {
      countSql += ' AND severity = ?';
      countParams.push(severity);
    }

    db.query(countSql, countParams, (countErr, countResults) => {
      if (countErr) {
        console.error('Error counting reports:', countErr);
        return res.status(500).json({ error: 'Lỗi đếm báo cáo: ' + countErr.message });
      }

      res.json({
        reports: results,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(countResults[0].total / limit),
          totalReports: countResults[0].total,
          limit: parseInt(limit)
        }
      });
    });
  });
});

// API: Cập nhật trạng thái báo cáo (cho admin)
app.put('/api/reports/:reportId', (req, res) => {
  const { reportId } = req.params;
  const { status, adminResponse } = req.body;

  // Validate status
  const validStatuses = ['pending', 'investigating', 'resolved', 'dismissed'];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ 
      error: 'Trạng thái không hợp lệ. Phải là: ' + validStatuses.join(', ') 
    });
  }

  let sql = 'UPDATE reports SET updatedAt = NOW()';
  const params = [];

  if (status) {
    sql += ', status = ?';
    params.push(status);
    
    if (status === 'resolved' || status === 'dismissed') {
      sql += ', resolvedAt = NOW()';
    }
  }

  if (adminResponse) {
    sql += ', adminResponse = ?';
    params.push(adminResponse);
  }

  sql += ' WHERE id = ?';
  params.push(reportId);

  db.query(sql, params, (err, result) => {
    if (err) {
      console.error('Error updating report:', err);
      return res.status(500).json({ error: 'Lỗi cập nhật báo cáo: ' + err.message });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Không tìm thấy báo cáo' });
    }

    // Nếu có cập nhật status, gửi notification cho customer
    if (status) {
      const getReportSql = 'SELECT customerId, title FROM reports WHERE id = ?';
      db.query(getReportSql, [reportId], (getErr, reportResults) => {
        if (!getErr && reportResults.length > 0) {
          const customerId = reportResults[0].customerId;
          const reportTitle = reportResults[0].title;
          
          const notificationSql = `INSERT INTO notifications 
            (userId, type, title, message, data, createdAt) 
            VALUES (?, 'report_update', ?, ?, ?, NOW())`;
          
          const notificationData = JSON.stringify({
            reportId: reportId,
            newStatus: status,
            adminResponse: adminResponse
          });

          const statusMessages = {
            investigating: 'đang được điều tra',
            resolved: 'đã được giải quyết',
            dismissed: 'đã bị từ chối'
          };

          db.query(notificationSql, [
            customerId,
            'Cập nhật báo cáo vi phạm',
            `Báo cáo "${reportTitle}" ${statusMessages[status] || 'đã được cập nhật'}`,
            notificationData
          ], (notifErr) => {
            if (notifErr) {
              console.error('Error creating customer notification:', notifErr);
            } else {
              console.log('✅ Customer notification created for report update');
            }
          });
        }
      });
    }

    res.json({
      message: 'Báo cáo đã được cập nhật thành công',
      reportId: reportId,
      affectedRows: result.affectedRows
    });
  });
});

// API: Lấy chi tiết một báo cáo
app.get('/api/reports/:reportId', (req, res) => {
  const { reportId } = req.params;

  const sql = `
    SELECT r.*, 
           b.service, b.startDate, b.customerName, b.housekeeperName, b.location, b.notes,
           c.fullName as customerFullName, c.email as customerEmail, c.phone as customerPhone,
           h.fullName as housekeeperFullName, h.email as housekeeperEmail, h.phone as housekeeperPhone
    FROM reports r
    LEFT JOIN bookings b ON r.bookingId = b.id
    LEFT JOIN users c ON r.customerId = c.id
    LEFT JOIN users h ON r.housekeeperId = h.id
    WHERE r.id = ?
  `;

  db.query(sql, [reportId], (err, results) => {
    if (err) {
      console.error('Error fetching report details:', err);
      return res.status(500).json({ error: 'Lỗi lấy chi tiết báo cáo: ' + err.message });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy báo cáo' });
    }

    res.json(results[0]);
  });
});

// ========================
// WARNINGS API - Cảnh cáo housekeeper
// ========================

// API: Gửi cảnh cáo đến housekeeper
app.post('/api/warnings', (req, res) => {
  const { 
    housekeeperId, 
    reportId, 
    adminId, 
    warningType, 
    title, 
    message, 
    severity,
    expiresAt 
  } = req.body;

  // Validate required fields
  if (!housekeeperId || !reportId || !adminId || !title || !message) {
    return res.status(400).json({ 
      error: 'Thiếu thông tin bắt buộc: housekeeperId, reportId, adminId, title, message' 
    });
  }

  // Validate warningType
  const validWarningTypes = ['verbal', 'written', 'final', 'suspension'];
  if (warningType && !validWarningTypes.includes(warningType)) {
    return res.status(400).json({ 
      error: 'Loại cảnh cáo không hợp lệ. Phải là: ' + validWarningTypes.join(', ') 
    });
  }

  const sql = `INSERT INTO warnings 
    (housekeeperId, reportId, adminId, warningType, title, message, severity, expiresAt, createdAt) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`;
    
  const values = [
    housekeeperId, 
    reportId, 
    adminId, 
    warningType || 'written', 
    title, 
    message, 
    severity || 'medium',
    expiresAt || null
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error('Error creating warning:', err);
      return res.status(500).json({ error: 'Lỗi tạo cảnh cáo: ' + err.message });
    }

    console.log(`✅ Warning created with ID: ${result.insertId} for housekeeper ${housekeeperId}`);
    
    // Tạo notification cho housekeeper về cảnh cáo mới
    const notificationSql = `INSERT INTO notifications 
      (userId, type, title, message, data, createdAt) 
      VALUES (?, 'warning_received', ?, ?, ?, NOW())`;
    
    const notificationData = JSON.stringify({
      warningId: result.insertId,
      reportId: reportId,
      warningType: warningType || 'written',
      severity: severity || 'medium'
    });

    db.query(notificationSql, [
      housekeeperId,
      'Bạn đã nhận cảnh cáo từ quản trị viên',
      `Cảnh cáo: ${title}`,
      notificationData
    ], (notifErr) => {
      if (notifErr) {
        console.error('Error creating housekeeper notification:', notifErr);
      } else {
        console.log('✅ Housekeeper notification created for warning');
      }
    });

    // Nếu là suspension, tạm khóa tài khoản housekeeper
    if (warningType === 'suspension' && expiresAt) {
      const suspendSql = 'UPDATE users SET isApproved = FALSE WHERE id = ? AND role = "housekeeper"';
      db.query(suspendSql, [housekeeperId], (suspendErr) => {
        if (suspendErr) {
          console.error('Error suspending housekeeper:', suspendErr);
        } else {
          console.log(`✅ Housekeeper ${housekeeperId} suspended until ${expiresAt}`);
        }
      });
    }

    res.status(201).json({
      message: 'Cảnh cáo đã được gửi thành công',
      warningId: result.insertId,
      housekeeperId: housekeeperId
    });
  });
});

// API: Lấy danh sách cảnh cáo của housekeeper
app.get('/api/warnings/housekeeper/:housekeeperId', (req, res) => {
  const { housekeeperId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  const sql = `
    SELECT w.*, 
           r.title as reportTitle, r.reportType,
           a.fullName as adminName
    FROM warnings w
    LEFT JOIN reports r ON w.reportId = r.id
    LEFT JOIN users a ON w.adminId = a.id
    WHERE w.housekeeperId = ?
    ORDER BY w.createdAt DESC
    LIMIT ? OFFSET ?
  `;

  const offset = (page - 1) * limit;
  const params = [housekeeperId, parseInt(limit), parseInt(offset)];

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error('Error fetching housekeeper warnings:', err);
      return res.status(500).json({ error: 'Lỗi lấy danh sách cảnh cáo: ' + err.message });
    }

    // Get total count
    const countSql = 'SELECT COUNT(*) as total FROM warnings WHERE housekeeperId = ?';
    db.query(countSql, [housekeeperId], (countErr, countResults) => {
      if (countErr) {
        console.error('Error counting warnings:', countErr);
        return res.status(500).json({ error: 'Lỗi đếm cảnh cáo: ' + countErr.message });
      }

      res.json({
        warnings: results,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(countResults[0].total / limit),
          totalWarnings: countResults[0].total,
          limit: parseInt(limit)
        }
      });
    });
  });
});

// API: Lấy tất cả cảnh cáo (cho admin)
app.get('/api/warnings', (req, res) => {
  const { housekeeperId, warningType, severity, page = 1, limit = 20 } = req.query;

  let sql = `
    SELECT w.*, 
           h.fullName as housekeeperName, h.email as housekeeperEmail,
           a.fullName as adminName,
           r.title as reportTitle, r.reportType
    FROM warnings w
    LEFT JOIN users h ON w.housekeeperId = h.id
    LEFT JOIN users a ON w.adminId = a.id
    LEFT JOIN reports r ON w.reportId = r.id
    WHERE 1=1
  `;
  const params = [];

  // Filters
  if (housekeeperId) {
    sql += ' AND w.housekeeperId = ?';
    params.push(housekeeperId);
  }

  if (warningType) {
    sql += ' AND w.warningType = ?';
    params.push(warningType);
  }

  if (severity) {
    sql += ' AND w.severity = ?';
    params.push(severity);
  }

  // Pagination
  const offset = (page - 1) * limit;
  sql += ' ORDER BY w.createdAt DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error('Error fetching all warnings:', err);
      return res.status(500).json({ error: 'Lỗi lấy danh sách cảnh cáo: ' + err.message });
    }

    // Get total count
    let countSql = 'SELECT COUNT(*) as total FROM warnings WHERE 1=1';
    const countParams = [];

    if (housekeeperId) {
      countSql += ' AND housekeeperId = ?';
      countParams.push(housekeeperId);
    }
    if (warningType) {
      countSql += ' AND warningType = ?';
      countParams.push(warningType);
    }
    if (severity) {
      countSql += ' AND severity = ?';
      countParams.push(severity);
    }

    db.query(countSql, countParams, (countErr, countResults) => {
      if (countErr) {
        console.error('Error counting warnings:', countErr);
        return res.status(500).json({ error: 'Lỗi đếm cảnh cáo: ' + countErr.message });
      }

      res.json({
        warnings: results,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(countResults[0].total / limit),
          totalWarnings: countResults[0].total,
          limit: parseInt(limit)
        }
      });
    });
  });
});

// API: Đánh dấu cảnh cáo đã đọc
app.put('/api/warnings/:warningId/read', (req, res) => {
  const { warningId } = req.params;

  const sql = 'UPDATE warnings SET isRead = TRUE, readAt = NOW() WHERE id = ?';
  
  db.query(sql, [warningId], (err, result) => {
    if (err) {
      console.error('Error marking warning as read:', err);
      return res.status(500).json({ error: 'Lỗi đánh dấu cảnh cáo: ' + err.message });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Không tìm thấy cảnh cáo' });
    }

    res.json({
      message: 'Đã đánh dấu cảnh cáo là đã đọc',
      warningId: warningId
    });
  });
});

// API: Lấy thống kê cảnh cáo của housekeeper
app.get('/api/warnings/stats/:housekeeperId', (req, res) => {
  const { housekeeperId } = req.params;

  const sql = `
    SELECT 
      COUNT(*) as totalWarnings,
      COUNT(CASE WHEN warningType = 'verbal' THEN 1 END) as verbalWarnings,
      COUNT(CASE WHEN warningType = 'written' THEN 1 END) as writtenWarnings,
      COUNT(CASE WHEN warningType = 'final' THEN 1 END) as finalWarnings,
      COUNT(CASE WHEN warningType = 'suspension' THEN 1 END) as suspensions,
      COUNT(CASE WHEN severity = 'critical' THEN 1 END) as criticalWarnings,
      COUNT(CASE WHEN createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as recentWarnings
    FROM warnings 
    WHERE housekeeperId = ?
  `;

  db.query(sql, [housekeeperId], (err, results) => {
    if (err) {
      console.error('Error fetching warning stats:', err);
      return res.status(500).json({ error: 'Lỗi lấy thống kê cảnh cáo: ' + err.message });
    }

    res.json(results[0] || {
      totalWarnings: 0,
      verbalWarnings: 0,
      writtenWarnings: 0,
      finalWarnings: 0,
      suspensions: 0,
      criticalWarnings: 0,
      recentWarnings: 0
    });
  });
});

// ========================
// ADMIN DASHBOARD APIs
// ========================

// API: Thống kê tổng quan hệ thống
app.get('/api/admin/dashboard/overview', (req, res) => {
  const queries = [
    // Tổng số users (không tính admin)
    'SELECT COUNT(*) as totalUsers FROM users WHERE role != "admin"',
    // Tổng số housekeepers
    'SELECT COUNT(*) as totalHousekeepers FROM users WHERE role = "housekeeper"',
    // Tổng số customers
    'SELECT COUNT(*) as totalCustomers FROM users WHERE role = "customer"',
    // Tổng số bookings
    'SELECT COUNT(*) as totalBookings FROM bookings',
    // Bookings hôm nay
    'SELECT COUNT(*) as todayBookings FROM bookings WHERE DATE(createdAt) = CURDATE()',
    // Revenue hôm nay (từ payments đã thành công)
    'SELECT COALESCE(SUM(p.amount), 0) as todayRevenue FROM payments p JOIN bookings b ON p.bookingId = b.id WHERE DATE(p.paidAt) = CURDATE() AND p.status = "success"',
    // Housekeepers đang hoạt động (available = 1)
    'SELECT COUNT(*) as activeHousekeepers FROM housekeepers WHERE available = 1',
    // Housekeepers đã xác minh và phê duyệt
    'SELECT COUNT(*) as verifiedHousekeepers FROM users WHERE role = "housekeeper" AND isVerified = 1 AND isApproved = 1',
    // Housekeepers chưa xác minh
    'SELECT COUNT(*) as unverifiedHousekeepers FROM users WHERE role = "housekeeper" AND (isVerified = 0 OR isApproved = 0)',
    // Housekeepers sẵn sàng nhận việc (verified + approved + available)
    'SELECT COUNT(*) as readyHousekeepers FROM users u JOIN housekeepers h ON u.id = h.userId WHERE u.role = "housekeeper" AND u.isVerified = 1 AND u.isApproved = 1 AND h.available = 1'
  ];

  Promise.all(queries.map(query => 
    new Promise((resolve, reject) => {
      db.query(query, (err, results) => {
        if (err) reject(err);
        else resolve(results[0]);
      });
    })
  )).then(results => {
    res.json({
      totalUsers: results[0].totalUsers,
      totalHousekeepers: results[1].totalHousekeepers,
      totalCustomers: results[2].totalCustomers,
      totalBookings: results[3].totalBookings,
      todayBookings: results[4].todayBookings,
      todayRevenue: results[5].todayRevenue,
      activeHousekeepers: results[6].activeHousekeepers,
      verifiedHousekeepers: results[7].verifiedHousekeepers,
      unverifiedHousekeepers: results[8].unverifiedHousekeepers,
      readyHousekeepers: results[9].readyHousekeepers
    });
  }).catch(err => {
    console.error('Error fetching overview stats:', err);
    res.status(500).json({ error: err.message });
  });
});

// API: Admin toggle trạng thái available của housekeeper
app.put('/api/admin/housekeepers/:userId/availability', (req, res) => {
  const { userId } = req.params;
  const { available } = req.body;
  
  if (available === undefined) {
    return res.status(400).json({ error: 'available status is required' });
  }
  
  const sql = 'UPDATE housekeepers SET available = ?, lastOnline = NOW() WHERE userId = ?';
  
  db.query(sql, [available ? 1 : 0, userId], (err, result) => {
    if (err) {
      console.error('Error updating housekeeper availability:', err);
      return res.status(500).json({ error: err.message });
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Housekeeper not found' });
    }
    
    console.log(`🔄 Admin set housekeeper ${userId} availability to ${available ? 'AVAILABLE' : 'UNAVAILABLE'}`);
    res.json({ 
      success: true, 
      message: `Housekeeper availability updated to ${available ? 'available' : 'unavailable'}` 
    });
  });
});

// API: Debug - Kiểm tra bảng housekeeper_services
app.get('/api/debug/housekeeper-services', (req, res) => {
  const sql = `
    SELECT 
      hs.housekeeperId,
      h.price,
      u.fullName,
      s.id as serviceId,
      s.name as serviceName
    FROM housekeeper_services hs
    JOIN housekeepers h ON hs.housekeeperId = h.id
    JOIN users u ON h.userId = u.id
    JOIN services s ON hs.serviceId = s.id
    ORDER BY u.fullName, s.name
  `;
  
  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    // Group by housekeeper
    const grouped = {};
    results.forEach(row => {
      if (!grouped[row.fullName]) {
        grouped[row.fullName] = {
          housekeeperId: row.housekeeperId,
          price: row.price,
          services: []
        };
      }
      grouped[row.fullName].services.push(row.serviceName);
    });
    
    res.json({ raw: results, grouped });
  });
});

// API: Debug - Xem tất cả housekeepers
app.get('/api/debug/housekeepers', (req, res) => {
  const sql = `
    SELECT u.id, u.fullName, u.email, u.role, u.isVerified, u.isApproved, 
           h.available, h.rating, h.completedJobs, h.userId as housekeeperId
    FROM users u 
    LEFT JOIN housekeepers h ON u.id = h.userId 
    WHERE u.role = 'housekeeper'
    ORDER BY u.id
  `;
  
  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

// API: Thống kê chi tiết người giúp việc
app.get('/api/admin/dashboard/housekeeper-details', (req, res) => {
  const sql = `
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN u.isVerified = 1 AND u.isApproved = 1 THEN 1 ELSE 0 END) as verified,
      SUM(CASE WHEN u.isVerified = 0 OR u.isApproved = 0 THEN 1 ELSE 0 END) as unverified,
      SUM(CASE WHEN h.available = 1 THEN 1 ELSE 0 END) as available,
      SUM(CASE WHEN h.available = 0 THEN 1 ELSE 0 END) as unavailable,
      SUM(CASE WHEN u.isVerified = 1 AND u.isApproved = 1 AND h.available = 1 THEN 1 ELSE 0 END) as ready,
      AVG(h.rating) as avgRating,
      SUM(h.completedJobs) as totalCompletedJobs
    FROM users u
    LEFT JOIN housekeepers h ON u.id = h.userId
    WHERE u.role = 'housekeeper'
  `;
  
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching housekeeper details:', err);
      return res.status(500).json({ error: err.message });
    }
    
    const stats = results[0];
    
    // Debug logging
    console.log('🔍 HOUSEKEEPER STATS DEBUG:');
    console.log('Raw query result:', stats);
    
    // Thêm query debug để xem chi tiết
    const debugSql = `
      SELECT u.id, u.fullName, u.role, u.isVerified, u.isApproved, h.available
      FROM users u 
      LEFT JOIN housekeepers h ON u.id = h.userId 
      WHERE u.role = 'housekeeper'
    `;
    
    db.query(debugSql, (debugErr, debugResults) => {
      if (!debugErr) {
        console.log('📋 All housekeepers in database:');
        debugResults.forEach((hk, index) => {
          console.log(`${index + 1}. ${hk.fullName} - Verified: ${hk.isVerified}, Approved: ${hk.isApproved}, Available: ${hk.available}`);
        });
      }
    });
    
    res.json({
      total: stats.total || 0,
      verified: stats.verified || 0,
      unverified: stats.unverified || 0,
      available: stats.available || 0,
      unavailable: stats.unavailable || 0,
      ready: stats.ready || 0,
      avgRating: parseFloat(stats.avgRating || 0).toFixed(1),
      totalCompletedJobs: stats.totalCompletedJobs || 0
    });
  });
});

// API: Thống kê bookings theo trạng thái
app.get('/api/admin/dashboard/booking-stats', (req, res) => {
  const sql = `
    SELECT 
      status,
      COUNT(*) as count,
      COALESCE(SUM(totalPrice), 0) as totalValue
    FROM bookings 
    GROUP BY status
  `;
  
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching booking stats:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

// API: Top housekeepers theo số đơn hoàn thành
app.get('/api/admin/dashboard/top-housekeepers', (req, res) => {
  const sql = `
    SELECT 
      u.fullName,
      u.email,
      h.completedJobs,
      h.rating,
      h.totalReviews,
      COUNT(b.id) as totalBookings,
      COALESCE(SUM(CASE WHEN b.status = 'completed' THEN b.totalPrice ELSE 0 END), 0) as totalEarnings
    FROM housekeepers h
    JOIN users u ON h.userId = u.id
    LEFT JOIN bookings b ON h.id = b.housekeeperId
    GROUP BY h.id, u.fullName, u.email, h.completedJobs, h.rating, h.totalReviews
    ORDER BY h.completedJobs DESC, h.rating DESC
    LIMIT 10
  `;
  
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching top housekeepers:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

// API: Thống kê theo thời gian (7 ngày gần nhất)
app.get('/api/admin/dashboard/time-stats', (req, res) => {
  const sql = `
    SELECT 
      DATE(createdAt) as date,
      COUNT(*) as bookings,
      COALESCE(SUM(totalPrice), 0) as revenue,
      COUNT(DISTINCT customerId) as uniqueCustomers
    FROM bookings 
    WHERE createdAt >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    GROUP BY DATE(createdAt)
    ORDER BY date DESC
  `;
  
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching time stats:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

// API: Thống kê dịch vụ phổ biến
app.get('/api/admin/dashboard/service-stats', (req, res) => {
  const sql = `
    SELECT 
      service,
      COUNT(*) as bookingCount,
      COALESCE(SUM(totalPrice), 0) as totalRevenue,
      AVG(totalPrice) as avgPrice
    FROM bookings 
    WHERE service IS NOT NULL
    GROUP BY service
    ORDER BY bookingCount DESC
    LIMIT 10
  `;
  
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching service stats:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

// API: Danh sách housekeepers với trạng thái hoạt động
app.get('/api/admin/housekeepers/status', (req, res) => {
  const sql = `
    SELECT 
      u.id,
      u.fullName,
      u.email,
      u.phone,
      h.available,
      h.lastOnline,
      h.completedJobs,
      h.rating,
      h.totalReviews,
      u.lastActiveAt,
      u.isVerified,
      u.isApproved
    FROM housekeepers h
    JOIN users u ON h.userId = u.id
    ORDER BY h.lastOnline DESC, u.lastActiveAt DESC
  `;
  
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching housekeeper status:', err);
      return res.status(500).json({ error: err.message });
    }
    
    const housekeepersWithStatus = results.map(hk => ({
      ...hk,
      status: hk.available ? 'available' : 'unavailable',
      lastSeen: hk.lastOnline || hk.lastActiveAt,
      isOnline: hk.lastOnline && new Date(hk.lastOnline) > new Date(Date.now() - 30 * 60 * 1000) // 30 phút
    }));
    
    res.json(housekeepersWithStatus);
  });
});

// API: Thống kê người dùng theo tháng
app.get('/api/admin/dashboard/user-growth', (req, res) => {
  const sql = `
    SELECT 
      DATE_FORMAT(createdAt, '%Y-%m') as month,
      role,
      COUNT(*) as count
    FROM users 
    WHERE createdAt >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
    GROUP BY DATE_FORMAT(createdAt, '%Y-%m'), role
    ORDER BY month DESC
  `;
  
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching user growth stats:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

// API: Cập nhật trạng thái housekeeper (approve/verify)
app.put('/api/admin/housekeepers/:userId/status', (req, res) => {
  const { userId } = req.params;
  const { isApproved, isVerified } = req.body;
  
  // Update user table
  const userSql = 'UPDATE users SET isApproved = ?, isVerified = ?, updatedAt = NOW() WHERE id = ? AND role = "housekeeper"';
  
  db.query(userSql, [isApproved, isVerified, userId], (err, result) => {
    if (err) {
      console.error('Error updating housekeeper status:', err);
      return res.status(500).json({ error: err.message });
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Housekeeper not found' });
    }
    
    // If both verified and approved, set available = 1 in housekeepers table
    if (isApproved && isVerified) {
      const housekeeperSql = 'UPDATE housekeepers SET available = 1, updatedAt = NOW() WHERE userId = ?';
      
      db.query(housekeeperSql, [userId], (hkErr, hkResult) => {
        if (hkErr) {
          console.error('Error updating housekeeper availability:', hkErr);
        } else {
          console.log(`✅ Housekeeper ${userId} set to AVAILABLE (verified + approved)`);
        }
      });
    } else {
      // If not fully approved/verified, set available = 0
      const housekeeperSql = 'UPDATE housekeepers SET available = 0, updatedAt = NOW() WHERE userId = ?';
      
      db.query(housekeeperSql, [userId], (hkErr, hkResult) => {
        if (hkErr) {
          console.error('Error updating housekeeper availability:', hkErr);
        } else {
          console.log(`🔴 Housekeeper ${userId} set to UNAVAILABLE (not fully approved)`);
        }
      });
    }
    
    // Lấy thông tin housekeeper để gửi WebSocket event
    db.query('SELECT fullName FROM users WHERE id = ?', [userId], (nameErr, nameResults) => {
      if (!nameErr && nameResults.length > 0) {
        const housekeeperName = nameResults[0].fullName;
        
        // Gửi WebSocket event để cập nhật real-time cho tất cả clients
        io.emit('housekeeper_status_updated', {
          userId: userId,
          housekeeperName: housekeeperName,
          isApproved: isApproved,
          isVerified: isVerified,
          available: isApproved && isVerified ? 1 : 0,
          timestamp: new Date().toISOString()
        });
        
        console.log(`📡 WebSocket event sent: housekeeper_status_updated for ${housekeeperName}`);
      }
    });
    
    res.json({ 
      message: 'Housekeeper status updated successfully',
      userId: userId,
      isApproved: isApproved,
      isVerified: isVerified,
      available: isApproved && isVerified ? 1 : 0
    });
  });
});

// ========================
// BOOKING COMPLETION & PAYMENT APIs
// ========================

// API: Housekeeper đánh dấu công việc hoàn thành
app.post('/api/bookings/:id/complete', (req, res) => {
  const bookingId = req.params.id;
  const { housekeeperId, completionNotes } = req.body;

  console.log(`🏁 Complete booking ${bookingId}`, { housekeeperId });

  db.query(
    `SELECT b.*, h.id AS hkRowId, h.userId AS hkUserId
     FROM bookings b
     JOIN housekeepers h ON b.housekeeperId = h.id
     WHERE b.id = ?`,
    [bookingId],
    (bkErr, bkRows) => {
      if (bkErr) {
        console.error('Error loading booking:', bkErr);
        return res.status(500).json({ error: 'Lỗi hệ thống' });
      }
      if (!bkRows.length) {
        return res.status(404).json({ error: 'Không tìm thấy booking' });
      }

      const row = bkRows[0];
      const hkRowId = row.hkRowId;
      const hkUserId = row.hkUserId;
      const bodyHk = housekeeperId != null && housekeeperId !== '' ? Number(housekeeperId) : null;
      const jwtUid = req.user ? Number(req.user.id) : NaN;
      const matchesJwt = req.user && req.user.role === 'housekeeper' && jwtUid === Number(hkUserId);
      const matchesBody =
        bodyHk != null && !Number.isNaN(bodyHk) &&
        (bodyHk === Number(hkRowId) || bodyHk === Number(hkUserId));
      if (!matchesJwt && !matchesBody) {
        return res.status(403).json({ error: 'Bạn không có quyền hoàn thành booking này' });
      }

      db.query('SELECT isVerified, isApproved FROM users WHERE id = ?', [hkUserId], (verifyErr, verifyResults) => {
        if (verifyErr) {
          console.error('Error checking housekeeper verification:', verifyErr);
          return res.status(500).json({ error: 'Lỗi kiểm tra trạng thái xác minh' });
        }

        if (!verifyResults.length) {
          return res.status(404).json({ error: 'Không tìm thấy housekeeper' });
        }

        const housekeeper = verifyResults[0];
        if (!housekeeper.isVerified || !housekeeper.isApproved) {
          return res.status(403).json({
            error: 'Bạn cần được xác minh và phê duyệt bởi admin trước khi có thể đánh dấu công việc hoàn thành',
            needsVerification: !housekeeper.isVerified,
            needsApproval: !housekeeper.isApproved
          });
        }

        db.query(
          'UPDATE bookings SET status = ?, updatedAt = NOW() WHERE id = ? AND housekeeperId = ?',
          ['completed', bookingId, hkRowId],
          (err, result) => {
            if (err) {
              console.error('Error completing booking:', err);
              return res.status(500).json({ error: err.message });
            }

            if (result.affectedRows === 0) {
              return res.status(404).json({ error: 'Booking not found or unauthorized' });
            }

            const booking = { ...row };
            delete booking.hkRowId;
            delete booking.hkUserId;

            db.query(
              'UPDATE housekeepers SET completedJobs = completedJobs + 1 WHERE id = ?',
              [hkRowId],
              (cjErr) => {
                if (cjErr) console.error('Error updating completed jobs:', cjErr);
              }
            );

            const paymentSql = `INSERT INTO payments (bookingId, customerId, method, amount, status, createdAt)` +
              ` SELECT ?, ?, ?, ?, ?, NOW() WHERE NOT EXISTS (` +
              `SELECT 1 FROM payments WHERE bookingId = ? AND customerId = ? LIMIT 1)`;
            db.query(
              paymentSql,
              [bookingId, booking.customerId, 'cash', booking.totalPrice, 'pending', bookingId, booking.customerId],
              (payErr) => {
                if (payErr) console.error('Error creating payment record:', payErr);
              }
            );

            const notificationToCustomer = {
              id: Date.now(),
              type: 'booking_completed',
              title: 'Công việc đã hoàn thành',
              message: `${booking.housekeeperName} đã hoàn thành công việc. Vui lòng xác nhận và thanh toán.`,
              bookingId: bookingId,
              booking: booking,
              timestamp: new Date(),
              read: false
            };

            console.log('✅ Sending completion notification to customer:', booking.customerId);
            sendNotificationToUser(booking.customerId, notificationToCustomer);

            const notifSql = `INSERT INTO notifications (userId, type, title, message, bookingId, data, createdAt, read_status) 
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
            db.query(
              notifSql,
              [
                booking.customerId,
                notificationToCustomer.type,
                notificationToCustomer.title,
                notificationToCustomer.message,
                bookingId,
                JSON.stringify({ ...booking, completionNotes }),
                new Date(),
                0
              ],
              (notifErr) => {
                if (notifErr) console.error('Error saving notification:', notifErr);
              }
            );

            res.json({
              message: 'Booking completed successfully',
              booking: booking,
              paymentRequired: true
            });
          });
      });
    });
});

// API: Customer xac nhan va thanh toan
app.post('/api/bookings/:id/confirm-payment', (req, res) => {
  const bookingId = req.params.id;
  const { customerId, paymentMethod, rating, review } = req.body;
  const normalizedMethod = normalizePaymentMethod(paymentMethod);

  console.log(`Customer ${customerId} confirming ${normalizedMethod} payment for booking ${bookingId}`);

  db.query('SELECT * FROM bookings WHERE id = ? AND customerId = ?', [bookingId, customerId], (bookingErr, bookingResults) => {
    if (bookingErr) {
      console.error('Error fetching booking before payment:', bookingErr);
      return res.status(500).json({ error: bookingErr.message });
    }

    if (!bookingResults || bookingResults.length === 0) {
      return res.status(404).json({ error: 'Booking not found or unauthorized' });
    }

    const booking = bookingResults[0];
    const breakdown = paymentBreakdown(booking.totalPrice);
    const transactionCode = normalizedMethod === 'momo'
      ? `MOMO_PLATFORM_${Date.now()}_${bookingId}`
      : `CASH_${Date.now()}_${bookingId}`;
    const settlementStatus = normalizedMethod === 'momo' ? 'holding' : 'cash_collected';

    const paymentValues = [
      normalizedMethod,
      breakdown.amount,
      breakdown.platformFee,
      breakdown.housekeeperAmount,
      settlementStatus,
      PLATFORM_PAYMENT_ACCOUNT,
      'success',
      transactionCode,
      bookingId,
      customerId,
    ];

    const updatePaymentSql = `
      UPDATE payments SET
        method = ?,
        amount = ?,
        platformFee = ?,
        housekeeperAmount = ?,
        settlementStatus = ?,
        platformAccount = ?,
        status = ?,
        transactionCode = ?,
        paidAt = NOW()
      WHERE bookingId = ? AND customerId = ?
    `;

    const insertPaymentSql = `
      INSERT INTO payments
        (bookingId, customerId, method, amount, platformFee, housekeeperAmount, settlementStatus, platformAccount, status, transactionCode, paidAt, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'success', ?, NOW(), NOW())
    `;

    const finishPayment = () => {
      db.query('UPDATE bookings SET paymentStatus = ? WHERE id = ?', ['success', bookingId], (paymentUpdateErr) => {
        if (paymentUpdateErr) console.error('Error updating booking payment status:', paymentUpdateErr);
      });

      if (rating) {
        const reviewSql = `INSERT INTO reviews (bookingId, housekeeperId, customerId, rating, comment, createdAt)
                          VALUES (?, ?, ?, ?, ?, NOW())`;
        db.query(reviewSql, [bookingId, booking.housekeeperId, customerId, rating, review || ''], (reviewErr) => {
          if (reviewErr) console.error('Error saving review:', reviewErr);

          const updateRatingSql = `
            UPDATE housekeepers SET
              rating = (SELECT AVG(rating) FROM reviews WHERE housekeeperId = ?),
              totalReviews = (SELECT COUNT(*) FROM reviews WHERE housekeeperId = ?)
            WHERE id = ?
          `;
          db.query(updateRatingSql, [booking.housekeeperId, booking.housekeeperId, booking.housekeeperId], (ratingErr) => {
            if (ratingErr) console.error('Error updating housekeeper rating:', ratingErr);
          });
        });
      }

      const payoutMessage = normalizedMethod === 'momo'
        ? `Platform da nhan thanh toan qua MoMo. So tien tam giu tra sau: ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(breakdown.housekeeperAmount)}.`
        : `Khach da xac nhan thanh toan tien mat. Phi platform can doi soat: ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(breakdown.platformFee)}.`;

      const notificationToHousekeeper = {
        id: Date.now(),
        type: 'payment_received',
        title: normalizedMethod === 'momo' ? 'Platform da nhan tien MoMo' : 'Da xac nhan tien mat',
        message: payoutMessage,
        bookingId: bookingId,
        booking: {
          ...booking,
          paymentMethod: normalizedMethod,
          platformFee: breakdown.platformFee,
          housekeeperAmount: breakdown.housekeeperAmount,
          settlementStatus,
        },
        timestamp: new Date(),
        read: false
      };

      db.query('SELECT userId FROM housekeepers WHERE id = ?', [booking.housekeeperId], (hkErr, hkResults) => {
        if (!hkErr && hkResults.length > 0) {
          const housekeeperUserId = hkResults[0].userId;
          sendNotificationToUser(housekeeperUserId, notificationToHousekeeper);

          const notifSql = `INSERT INTO notifications (userId, type, title, message, bookingId, data, createdAt, read_status)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
          db.query(notifSql, [
            housekeeperUserId,
            notificationToHousekeeper.type,
            notificationToHousekeeper.title,
            notificationToHousekeeper.message,
            bookingId,
            JSON.stringify({ ...booking, paymentMethod: normalizedMethod, rating, review, ...breakdown, settlementStatus }),
            new Date(),
            0
          ], (notifErr) => {
            if (notifErr) console.error('Error saving notification:', notifErr);
          });
        }
      });

      return res.json({
        message: normalizedMethod === 'momo'
          ? 'MoMo payment confirmed to platform account'
          : 'Cash payment confirmed',
        booking: {
          ...booking,
          paymentStatus: 'success',
          paymentMethod: normalizedMethod,
          platformFee: breakdown.platformFee,
          housekeeperAmount: breakdown.housekeeperAmount,
          settlementStatus,
        },
        payment: {
          amount: breakdown.amount,
          housekeeperAmount: breakdown.housekeeperAmount,
          method: normalizedMethod,
          platformAccount: PLATFORM_PAYMENT_ACCOUNT,
          platformFee: breakdown.platformFee,
          settlementStatus,
          transactionCode,
        },
        paymentStatus: 'success'
      });
    };

    db.query(updatePaymentSql, paymentValues, (paymentErr, updateResult) => {
      if (paymentErr) {
        console.error('Error updating payment:', paymentErr);
        return res.status(500).json({ error: paymentErr.message });
      }

      if (updateResult && updateResult.affectedRows > 0) {
        return finishPayment();
      }

      db.query(
        insertPaymentSql,
        [
          bookingId,
          customerId,
          normalizedMethod,
          breakdown.amount,
          breakdown.platformFee,
          breakdown.housekeeperAmount,
          settlementStatus,
          PLATFORM_PAYMENT_ACCOUNT,
          transactionCode,
        ],
        (insertErr) => {
          if (insertErr) {
            console.error('Error inserting payment:', insertErr);
            return res.status(500).json({ error: insertErr.message });
          }

          return finishPayment();
        }
      );
    });
  });
});
// API: Lấy thông tin payment cho booking
app.get('/api/bookings/:id/payment', (req, res) => {
  const bookingId = req.params.id;
  
  const sql = `
    SELECT p.*, b.totalPrice, b.customerName, b.housekeeperName, b.service
    FROM payments p
    JOIN bookings b ON p.bookingId = b.id
    WHERE p.bookingId = ?
  `;
  
  db.query(sql, [bookingId], (err, results) => {
    if (err) {
      console.error('Error fetching payment info:', err);
      return res.status(500).json({ error: err.message });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    res.json(results[0]);
  });
});

// API: Housekeeper earnings held by platform / cash reconciliation
app.get('/api/housekeepers/:userId/earnings', (req, res) => {
  const { userId } = req.params;

  if (req.user && req.user.role !== 'admin' && Number(req.user.id) !== Number(userId)) {
    return res.status(403).json({ error: 'Ban chi co the xem thu nhap cua chinh minh' });
  }

  const sql = `
    SELECT
      COALESCE(SUM(CASE WHEN p.status = 'success' THEN p.amount ELSE 0 END), 0) as grossPaid,
      COALESCE(SUM(CASE WHEN p.status = 'success' THEN p.platformFee ELSE 0 END), 0) as platformFees,
      COALESCE(SUM(CASE WHEN p.status = 'success' AND p.method = 'momo' AND p.settlementStatus IN ('holding','ready') THEN p.housekeeperAmount ELSE 0 END), 0) as pendingPayout,
      COALESCE(SUM(CASE WHEN p.status = 'success' AND p.method = 'momo' AND p.settlementStatus = 'paid' THEN p.housekeeperAmount ELSE 0 END), 0) as paidOut,
      COALESCE(SUM(CASE WHEN p.status = 'success' AND p.method = 'cash' THEN p.amount ELSE 0 END), 0) as cashCollected,
      COALESCE(SUM(CASE WHEN p.status = 'success' AND p.method = 'cash' THEN p.platformFee ELSE 0 END), 0) as cashPlatformFeeDue,
      COUNT(CASE WHEN p.status = 'success' THEN 1 END) as paidBookings
    FROM payments p
    JOIN bookings b ON p.bookingId = b.id
    JOIN housekeepers h ON b.housekeeperId = h.id
    WHERE h.userId = ?
  `;

  db.query(sql, [userId], (err, rows) => {
    if (err) {
      console.error('Error fetching housekeeper earnings:', err);
      return res.status(500).json({ error: err.message });
    }

    res.json(rows[0] || {
      grossPaid: 0,
      platformFees: 0,
      pendingPayout: 0,
      paidOut: 0,
      cashCollected: 0,
      cashPlatformFeeDue: 0,
      paidBookings: 0,
    });
  });
});
// ========================
// REVIEWS MANAGEMENT APIs
// ========================

// API: Lấy tất cả reviews (cho admin)
app.get('/api/admin/reviews', (req, res) => {
  const sql = `
    SELECT r.*, 
           u1.fullName as customerName, u1.email as customerEmail,
           u2.fullName as housekeeperName, u2.email as housekeeperEmail,
           b.notes as service, b.startDate as bookingDate
    FROM reviews r
    JOIN users u1 ON r.customerId = u1.id
    JOIN housekeepers h ON r.housekeeperId = h.id
    JOIN users u2 ON h.userId = u2.id
    LEFT JOIN bookings b ON r.bookingId = b.id
    ORDER BY r.createdAt DESC
  `;
  
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching reviews:', err);
      return res.status(500).json({ error: err.message });
    }
    
    res.json(results);
  });
});

// API: Lấy reviews của một housekeeper cụ thể
app.get('/api/housekeepers/:id/reviews', (req, res) => {
  const housekeeperId = req.params.id;
  
  const sql = `
    SELECT r.*, 
           u.fullName as customerName,
           b.notes as service, b.startDate as bookingDate
    FROM reviews r
    JOIN users u ON r.customerId = u.id
    LEFT JOIN bookings b ON r.bookingId = b.id
    WHERE r.housekeeperId = ? AND r.isVisible = 1
    ORDER BY r.createdAt DESC
  `;
  
  db.query(sql, [housekeeperId], (err, results) => {
    if (err) {
      console.error('Error fetching housekeeper reviews:', err);
      return res.status(500).json({ error: err.message });
    }
    
    res.json(results);
  });
});

// API: Xóa review (cho admin)
app.delete('/api/admin/reviews/:id', (req, res) => {
  const reviewId = req.params.id;
  
  db.query('DELETE FROM reviews WHERE id = ?', [reviewId], (err, result) => {
    if (err) {
      console.error('Error deleting review:', err);
      return res.status(500).json({ error: err.message });
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }
    
    res.json({ message: 'Review deleted successfully' });
  });
});

// API: Ẩn/hiện review (cho admin)
app.put('/api/admin/reviews/:id/visibility', (req, res) => {
  const reviewId = req.params.id;
  const { visible } = req.body;
  
  db.query('UPDATE reviews SET isVisible = ? WHERE id = ?', [visible ? 1 : 0, reviewId], (err, result) => {
    if (err) {
      console.error('Error updating review visibility:', err);
      return res.status(500).json({ error: err.message });
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }
    
    res.json({ message: 'Review visibility updated successfully' });
  });
});

// ========================
// CHAT SYSTEM APIs
// ========================

// API: Lấy tin nhắn của một booking
app.get('/api/bookings/:bookingId/messages', (req, res) => {
  const { bookingId } = req.params;
  
  const sql = `
    SELECT cm.*, 
           sender.fullName as senderName,
           receiver.fullName as receiverName
    FROM chat_messages cm
    JOIN users sender ON cm.senderId = sender.id
    JOIN users receiver ON cm.receiverId = receiver.id
    WHERE cm.bookingId = ?
    ORDER BY cm.createdAt ASC
  `;
  
  db.query(sql, [bookingId], (err, results) => {
    if (err) {
      console.error('Error fetching messages:', err);
      return res.status(500).json({ error: err.message });
    }
    
    console.log(`💬 Found ${results.length} messages for booking ${bookingId}`);
    res.json(results);
  });
});

// API: Gửi tin nhắn trong booking
app.post('/api/bookings/:bookingId/messages', (req, res) => {
  const { bookingId } = req.params;
  const { senderId, receiverId, message, messageType = 'text' } = req.body;
  
  if (!senderId || !receiverId || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const sql = `
    INSERT INTO chat_messages (bookingId, senderId, receiverId, message, messageType, createdAt)
    VALUES (?, ?, ?, ?, ?, NOW())
  `;
  
  db.query(sql, [bookingId, senderId, receiverId, message, messageType], (err, result) => {
    if (err) {
      console.error('Error sending message:', err);
      return res.status(500).json({ error: err.message });
    }
    
    // Lấy tin nhắn vừa tạo với thông tin đầy đủ
    const selectSql = `
      SELECT cm.*, 
             sender.fullName as senderName,
             receiver.fullName as receiverName
      FROM chat_messages cm
      JOIN users sender ON cm.senderId = sender.id
      JOIN users receiver ON cm.receiverId = receiver.id
      WHERE cm.id = ?
    `;
    
    db.query(selectSql, [result.insertId], (selectErr, selectResults) => {
      if (selectErr) {
        console.error('Error fetching new message:', selectErr);
        return res.status(500).json({ error: selectErr.message });
      }
      
      const newMessage = selectResults[0];
      
      // Gửi WebSocket event
      io.emit('new_message', {
        id: newMessage.id,
        bookingId: parseInt(bookingId),
        senderId: newMessage.senderId,
        receiverId: newMessage.receiverId,
        message: newMessage.message,
        messageType: newMessage.messageType,
        senderName: newMessage.senderName,
        receiverName: newMessage.receiverName,
        timestamp: newMessage.createdAt
      });
      
      console.log(`📨 New message sent in booking ${bookingId}`);
      notifyUserAboutChatMessage(newMessage);
      res.json(newMessage);
    });
  });
});

// API: Đánh dấu tin nhắn đã đọc
app.put('/api/bookings/:bookingId/mark-read', (req, res) => {
  const { bookingId } = req.params;
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  
  const sql = `
    INSERT INTO chat_read_status (userId, bookingId, lastReadAt) 
    VALUES (?, ?, NOW()) 
    ON DUPLICATE KEY UPDATE lastReadAt = NOW()
  `;
  
  db.query(sql, [userId, bookingId], (err, result) => {
    if (err) {
      console.error('Error marking messages as read:', err);
      return res.status(500).json({ error: err.message });
    }
    
    console.log(`✅ Messages marked as read for user ${userId} in booking ${bookingId}`);
    res.json({ success: true });
  });
});

// API: Lấy tin nhắn giữa 2 users (tất cả bookings)
app.get('/api/users/:userId1/messages/:userId2', (req, res) => {
  const { userId1, userId2 } = req.params;
  
  const sql = `
    SELECT cm.*, 
           sender.fullName as senderName,
           receiver.fullName as receiverName,
           b.id as bookingId
    FROM chat_messages cm
    JOIN users sender ON cm.senderId = sender.id
    JOIN users receiver ON cm.receiverId = receiver.id
    JOIN bookings b ON cm.bookingId = b.id
    WHERE ((cm.senderId = ? AND cm.receiverId = ?) OR (cm.senderId = ? AND cm.receiverId = ?))
    ORDER BY cm.createdAt ASC
  `;
  
  db.query(sql, [userId1, userId2, userId2, userId1], (err, results) => {
    if (err) {
      console.error('Error fetching user messages:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log(`💬 Found ${results.length} messages between users ${userId1} and ${userId2}`);
    res.json(results);
  });
});

// API: Gửi tin nhắn giữa 2 users (tìm booking gần nhất)
app.post('/api/users/:userId1/messages/:userId2', (req, res) => {
  const { userId1, userId2 } = req.params;
  const { message, messageType = 'text' } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }
  
  // Tìm booking gần nhất giữa 2 users
  const findBookingSql = `
    SELECT b.id, b.customerId, b.housekeeperId, h.userId as housekeeperUserId
    FROM bookings b
    LEFT JOIN housekeepers h ON b.housekeeperId = h.id
    WHERE ((b.customerId = ? AND h.userId = ?) OR (b.customerId = ? AND h.userId = ?))
    ORDER BY b.createdAt DESC
    LIMIT 1
  `;
  
  db.query(findBookingSql, [userId1, userId2, userId2, userId1], (err, bookingResults) => {
    if (err) {
      console.error('Error finding booking:', err);
      return res.status(500).json({ error: err.message });
    }
    
    const insertMessage = (bookingId) => {
      const insertSql = `
        INSERT INTO chat_messages (bookingId, senderId, receiverId, message, messageType, createdAt)
        VALUES (?, ?, ?, ?, ?, NOW())
      `;
      
      db.query(insertSql, [bookingId, userId1, userId2, message, messageType], (insertErr, result) => {
        if (insertErr) {
          console.error('Error sending message:', insertErr);
          return res.status(500).json({ error: insertErr.message });
        }
        
        const selectSql = `
          SELECT cm.*, 
                 sender.fullName as senderName,
                 receiver.fullName as receiverName
          FROM chat_messages cm
          JOIN users sender ON cm.senderId = sender.id
          JOIN users receiver ON cm.receiverId = receiver.id
          WHERE cm.id = ?
        `;
        
        db.query(selectSql, [result.insertId], (selectErr, selectResults) => {
          if (selectErr) {
            console.error('Error fetching new message:', selectErr);
            return res.status(500).json({ error: selectErr.message });
          }
          
          const newMessage = selectResults[0];
          
          io.emit('new_message', {
            id: newMessage.id,
            bookingId: parseInt(bookingId),
            senderId: newMessage.senderId,
            receiverId: newMessage.receiverId,
            message: newMessage.message,
            messageType: newMessage.messageType,
            senderName: newMessage.senderName,
            receiverName: newMessage.receiverName,
            timestamp: newMessage.createdAt
          });
          
          console.log(`Direct message sent between users ${userId1} and ${userId2}`);
          notifyUserAboutChatMessage(newMessage);
      res.json(newMessage);
        });
      });
    };

    if (bookingResults.length > 0) {
      insertMessage(bookingResults[0].id);
      return;
    }

    const directBookingSql = `
      SELECT
        u1.id AS user1Id, u1.fullName AS user1Name, u1.email AS user1Email, u1.phone AS user1Phone,
        u2.id AS user2Id, u2.fullName AS user2Name, u2.email AS user2Email, u2.phone AS user2Phone,
        h1.id AS housekeeper1Id,
        h2.id AS housekeeper2Id
      FROM users u1
      JOIN users u2 ON u2.id = ?
      LEFT JOIN housekeepers h1 ON h1.userId = u1.id
      LEFT JOIN housekeepers h2 ON h2.userId = u2.id
      WHERE u1.id = ?
      LIMIT 1
    `;

    db.query(directBookingSql, [userId2, userId1], (directErr, directRows) => {
      if (directErr) {
        console.error('Error preparing direct chat booking:', directErr);
        return res.status(500).json({ error: directErr.message });
      }

      if (directRows.length === 0) {
        return res.status(404).json({ error: 'Kh�ng t�m th?y ngu?i d�ng d? nh?n tin' });
      }

      const row = directRows[0];
      const firstUserIsHousekeeper = Boolean(row.housekeeper1Id);
      const secondUserIsHousekeeper = Boolean(row.housekeeper2Id);

      if (firstUserIsHousekeeper === secondUserIsHousekeeper) {
        return res.status(400).json({ error: 'Ch? h? tr? nh?n tr?c ti?p gi?a kh�ch h�ng v� ngu?i gi�p vi?c' });
      }

      const customer = firstUserIsHousekeeper
        ? { id: row.user2Id, name: row.user2Name, email: row.user2Email, phone: row.user2Phone }
        : { id: row.user1Id, name: row.user1Name, email: row.user1Email, phone: row.user1Phone };
      const housekeeper = firstUserIsHousekeeper
        ? { id: row.housekeeper1Id, name: row.user1Name }
        : { id: row.housekeeper2Id, name: row.user2Name };

      const createBookingSql = `
        INSERT INTO bookings (
          customerId, housekeeperId, startDate, endDate, status, paymentStatus,
          totalPrice, notes, customerAddress, time, duration, location,
          customerName, customerEmail, customerPhone, housekeeperName, service,
          urgency, isQuickBooking, matchScore
        ) VALUES (?, ?, NOW(), NOW(), 'pending', 'pending', 0, ?, '', '', 0, '', ?, ?, ?, ?, ?, 'normal', FALSE, 0)
      `;

      db.query(createBookingSql, [
        customer.id,
        housekeeper.id,
        'Cu?c tr� chuy?n tr?c ti?p',
        customer.name,
        customer.email,
        customer.phone,
        housekeeper.name,
        'Trao d?i tr?c ti?p'
      ], (createErr, createResult) => {
        if (createErr) {
          console.error('Error creating direct chat booking:', createErr);
          return res.status(500).json({ error: createErr.message });
        }

        insertMessage(createResult.insertId);
      });
    });
  });
});

// API: Lấy danh sách conversations theo user (booking-based)
app.get('/api/users/:userId/conversations', (req, res) => {
  const { userId } = req.params;
  
  const sql = `
    SELECT
      b.id as bookingId,
      b.service,
      b.status as bookingStatus,
      b.customerId,
      b.housekeeperId,
      b.customerName,
      b.housekeeperName,
      CASE 
        WHEN b.customerId = ? THEN COALESCE(h.userId, b.housekeeperId)
        ELSE b.customerId
      END as otherUserId,
      CASE 
        WHEN b.customerId = ? THEN b.housekeeperName
        ELSE b.customerName
      END as otherUserName,
      CASE 
        WHEN b.customerId = ? THEN 'housekeeper'
        ELSE 'customer'
      END as otherUserRole,
      (SELECT cm.message 
       FROM chat_messages cm 
       WHERE cm.bookingId = b.id 
       ORDER BY cm.createdAt DESC 
       LIMIT 1) as lastMessage,
      (SELECT cm.createdAt 
       FROM chat_messages cm 
       WHERE cm.bookingId = b.id 
       ORDER BY cm.createdAt DESC 
       LIMIT 1) as lastMessageTime,
      (SELECT COUNT(*) 
       FROM chat_messages cm 
       WHERE cm.bookingId = b.id 
       AND cm.receiverId = ? 
       AND cm.createdAt > COALESCE(
         (SELECT lastReadAt FROM chat_read_status WHERE userId = ? AND bookingId = b.id),
         '1970-01-01'
       )) as unreadCount,
      b.createdAt as bookingCreatedAt
    FROM bookings b
    LEFT JOIN housekeepers h ON b.housekeeperId = h.id
    WHERE (b.customerId = ? OR h.userId = ?)
    ORDER BY COALESCE(lastMessageTime, b.createdAt) DESC
  `;
  
  db.query(sql, [userId, userId, userId, userId, userId, userId, userId, userId], (err, results) => {
    if (err) {
      console.error('Error fetching conversations:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log(`📋 Found ${results.length} conversations for user ${userId}`);
    console.log(`📋 API /api/users/${userId}/conversations returned:`, JSON.stringify(results, null, 2));
    res.json(results);
  });
});

// API: Lấy danh sách conversations theo user (simplified)
app.get('/api/users/:userId/user-conversations', (req, res) => {
  const { userId } = req.params;
  
  const sql = `
    SELECT
      CASE 
        WHEN cm.senderId = ? THEN cm.receiverId
        ELSE cm.senderId
      END as otherUserId,
      CASE 
        WHEN cm.senderId = ? THEN receiver.fullName
        ELSE sender.fullName
      END as otherUserName,
      CASE 
        WHEN cm.senderId = ? THEN 
          (SELECT role FROM users WHERE id = cm.receiverId)
        ELSE 
          (SELECT role FROM users WHERE id = cm.senderId)
      END as otherUserRole,
      (SELECT cm2.message 
       FROM chat_messages cm2 
       WHERE ((cm2.senderId = ? AND cm2.receiverId = (CASE WHEN cm.senderId = ? THEN cm.receiverId ELSE cm.senderId END)) OR
              (cm2.receiverId = ? AND cm2.senderId = (CASE WHEN cm.senderId = ? THEN cm.receiverId ELSE cm.senderId END)))
       ORDER BY cm2.createdAt DESC 
       LIMIT 1) as lastMessage,
      (SELECT cm2.createdAt 
       FROM chat_messages cm2 
       WHERE ((cm2.senderId = ? AND cm2.receiverId = (CASE WHEN cm.senderId = ? THEN cm.receiverId ELSE cm.senderId END)) OR
              (cm2.receiverId = ? AND cm2.senderId = (CASE WHEN cm.senderId = ? THEN cm.receiverId ELSE cm.senderId END)))
       ORDER BY cm2.createdAt DESC 
       LIMIT 1) as lastMessageTime
    FROM chat_messages cm
    JOIN users sender ON cm.senderId = sender.id
    JOIN users receiver ON cm.receiverId = receiver.id
    WHERE (cm.senderId = ? OR cm.receiverId = ?)
    ORDER BY lastMessageTime DESC
  `;
  
  db.query(sql, [
    userId, userId, userId, userId, userId, userId, userId,
    userId, userId, userId, userId, userId, userId
  ], (err, results) => {
    if (err) {
      console.error('Error fetching user conversations:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log(`📋 Found ${results.length} user conversations for user ${userId}`);
    res.json(results);
  });
});

// ========================
// CHAT SYSTEM APIs - DELETE MESSAGE
// ========================

// API: Xóa tin nhắn
app.delete('/api/messages/:messageId', (req, res) => {
  const { messageId } = req.params;
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  
  // Kiểm tra xem tin nhắn có thuộc về user này không
  const checkSql = 'SELECT * FROM chat_messages WHERE id = ? AND senderId = ?';
  
  db.query(checkSql, [messageId, userId], (err, results) => {
    if (err) {
      console.error('Error checking message ownership:', err);
      return res.status(500).json({ error: err.message });
    }
    
    if (results.length === 0) {
      return res.status(403).json({ error: 'Bạn chỉ có thể xóa tin nhắn của mình' });
    }
    
    // Xóa tin nhắn
    const deleteSql = 'DELETE FROM chat_messages WHERE id = ?';
    
    db.query(deleteSql, [messageId], (deleteErr, deleteResult) => {
      if (deleteErr) {
        console.error('Error deleting message:', deleteErr);
        return res.status(500).json({ error: deleteErr.message });
      }
      
      if (deleteResult.affectedRows === 0) {
        return res.status(404).json({ error: 'Tin nhắn không tồn tại' });
      }
      
      // Emit WebSocket event để cập nhật real-time
      io.emit('message_deleted', {
        messageId: parseInt(messageId),
        bookingId: results[0].bookingId,
        deletedBy: userId
      });
      
      console.log(`🗑️ Message ${messageId} deleted by user ${userId}`);
      res.json({ success: true, message: 'Tin nhắn đã được xóa' });
    });
  });
});

// API: Xóa toàn bộ cuộc trò chuyện
app.delete('/api/conversations/:bookingId', (req, res) => {
  const { bookingId } = req.params;
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  
  // Kiểm tra xem user có tin nhắn trong conversation này không
  const checkSql = `
    SELECT bookingId 
    FROM chat_messages 
    WHERE bookingId = ? AND (senderId = ? OR receiverId = ?)
    LIMIT 1
  `;
  
  db.query(checkSql, [bookingId, userId, userId], (err, results) => {
    if (err) {
      console.error('Error checking conversation ownership:', err);
      return res.status(500).json({ error: err.message });
    }
    
    if (results.length === 0) {
      return res.status(403).json({ error: 'Bạn không có quyền xóa cuộc trò chuyện này' });
    }
    
    // Xóa chat read status trước (nếu bảng tồn tại)
    const deleteReadStatusSql = 'DELETE FROM chat_read_status WHERE bookingId = ?';
    
    db.query(deleteReadStatusSql, [bookingId], (readErr) => {
      if (readErr) {
        console.error('Warning: Error deleting read status (table may not exist):', readErr.message);
        // Không return error, tiếp tục xóa messages
      }
      
      // Xóa tất cả tin nhắn trong conversation
      const deleteSql = 'DELETE FROM chat_messages WHERE bookingId = ?';
      
      db.query(deleteSql, [bookingId], (deleteErr, deleteResult) => {
        if (deleteErr) {
          console.error('Error deleting conversation messages:', deleteErr);
          return res.status(500).json({ error: `Không thể xóa tin nhắn: ${deleteErr.message}` });
        }
        
        // Emit WebSocket event để cập nhật real-time
        io.emit('conversation_deleted', {
          bookingId: parseInt(bookingId),
          deletedBy: userId,
          messagesDeleted: deleteResult.affectedRows
        });
        
        console.log(`🗑️ Conversation ${bookingId} deleted by user ${userId} (${deleteResult.affectedRows} messages)`);
        res.json({ 
          success: true, 
          message: `Đã xóa cuộc trò chuyện (${deleteResult.affectedRows} tin nhắn)` 
        });
      });
    });
  });
});

// ========================
// CHATBOT AI APIs
// ========================

// API: Chat với AI Assistant
app.post('/api/chatbot/message', async (req, res) => {
  try {
    const { message, conversationHistory, userContext } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Lấy thông tin user context từ database nếu có userId
    let enrichedContext = userContext || {};
    
    if (userContext?.userId) {
      const userSql = 'SELECT fullName, email, phone FROM users WHERE id = ?';
      const userResult = await new Promise((resolve, reject) => {
        db.query(userSql, [userContext.userId], (err, results) => {
          if (err) reject(err);
          else resolve(results[0] || {});
        });
      });
      
      // Lấy lịch sử booking của user
      const bookingSql = `
        SELECT s.name as serviceName, COUNT(*) as count 
        FROM bookings b 
        JOIN services s ON b.serviceId = s.id 
        WHERE b.customerId = ? 
        GROUP BY s.name
      `;
      const bookingResult = await new Promise((resolve, reject) => {
        db.query(bookingSql, [userContext.userId], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });

      enrichedContext = {
        ...enrichedContext,
        name: userResult.fullName,
        email: userResult.email,
        phone: userResult.phone,
        previousBookings: bookingResult.map(b => b.serviceName)
      };
    }

    const result = await chatbotService.processMessage(message, conversationHistory, enrichedContext);
    
    // Force correct suggestions based on user role
    let correctSuggestions = result.suggestions;
    if (enrichedContext.role === 'housekeeper') {
      correctSuggestions = [
        'Quản lý đơn hàng',
        'Tối ưu giá dịch vụ', 
        'Cải thiện đánh giá',
        'Hướng dẫn app Housekeeper',
        'Giải quyết vấn đề với khách'
      ];
      console.log('🔧 FORCE FIX - Using housekeeper suggestions');
    } else if (enrichedContext.role === 'admin') {
      correctSuggestions = [
        'Phân tích dữ liệu',
        'Quản lý người dùng',
        'Báo cáo hệ thống',
        'Xử lý khiếu nại',
        'Cấu hình hệ thống'
      ];
      console.log('🔧 FORCE FIX - Using admin suggestions');
    }
    
    res.json({
      success: true,
      response: result.response,
      intent: result.intent,
      suggestions: correctSuggestions,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Chatbot API error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Xin lỗi, tôi đang gặp sự cố kỹ thuật. Vui lòng thử lại sau.'
    });
  }
});

// API: Tính toán chi phí dự kiến
app.post('/api/chatbot/calculate-cost', (req, res) => {
  try {
    const { service, duration, location } = req.body;
    
    if (!service || !duration) {
      return res.status(400).json({ error: 'Service and duration are required' });
    }

    const costEstimate = chatbotService.calculateEstimatedCost(service, duration, location);
    
    if (!costEstimate) {
      return res.status(404).json({ error: 'Service not found' });
    }

    res.json({
      success: true,
      estimate: costEstimate
    });

  } catch (error) {
    console.error('Cost calculation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Gợi ý gói combo
app.post('/api/chatbot/combo-recommendations', (req, res) => {
  try {
    const { services, frequency } = req.body;
    
    if (!services || !Array.isArray(services)) {
      return res.status(400).json({ error: 'Services array is required' });
    }

    const recommendations = chatbotService.getComboRecommendations(services, frequency);
    
    res.json({
      success: true,
      recommendations: recommendations
    });

  } catch (error) {
    console.error('Combo recommendations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Lưu conversation với AI
app.post('/api/chatbot/save-conversation', (req, res) => {
  try {
    const { userId, conversationData, sessionId } = req.body;
    
    if (!userId || !conversationData) {
      return res.status(400).json({ error: 'UserId and conversationData are required' });
    }

    // Tạo bảng chatbot_conversations nếu chưa có
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS chatbot_conversations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        sessionId VARCHAR(100),
        conversationData JSON,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      )
    `;

    db.query(createTableSql, (createErr) => {
      if (createErr) {
        console.error('Error creating chatbot_conversations table:', createErr);
        return res.status(500).json({ error: 'Database error' });
      }

      // Lưu conversation
      const insertSql = `
        INSERT INTO chatbot_conversations (userId, sessionId, conversationData) 
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE 
        conversationData = VALUES(conversationData),
        updatedAt = CURRENT_TIMESTAMP
      `;

      db.query(insertSql, [userId, sessionId, JSON.stringify(conversationData)], (err, result) => {
        if (err) {
          console.error('Error saving conversation:', err);
          return res.status(500).json({ error: 'Failed to save conversation' });
        }

        res.json({
          success: true,
          conversationId: result.insertId || result.insertId,
          message: 'Conversation saved successfully'
        });
      });
    });

  } catch (error) {
    console.error('Save conversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Lấy lịch sử conversation
app.get('/api/chatbot/conversations/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10 } = req.query;

    const sql = `
      SELECT id, sessionId, conversationData, createdAt, updatedAt
      FROM chatbot_conversations 
      WHERE userId = ? 
      ORDER BY updatedAt DESC 
      LIMIT ?
    `;

    db.query(sql, [userId, parseInt(limit)], (err, results) => {
      if (err) {
        console.error('Error fetching conversations:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      const conversations = results.map(row => ({
        ...row,
        conversationData: JSON.parse(row.conversationData)
      }));

      res.json({
        success: true,
        conversations: conversations
      });
    });

  } catch (error) {
    console.error('Fetch conversations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Gửi khiếu nại
app.post('/api/complaints/submit', (req, res) => {
  try {
    const complaintData = req.body;
    
    // Tạo bảng complaints nếu chưa có
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS complaints (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ticketId VARCHAR(50) UNIQUE NOT NULL,
        userId INT,
        userName VARCHAR(100),
        userEmail VARCHAR(100),
        type VARCHAR(50) NOT NULL,
        severity ENUM('low', 'medium', 'high') DEFAULT 'medium',
        bookingId VARCHAR(50),
        description TEXT NOT NULL,
        evidence JSON,
        contactPreference ENUM('email', 'phone', 'both') DEFAULT 'email',
        status ENUM('pending', 'investigating', 'resolved', 'closed') DEFAULT 'pending',
        assignedTo INT,
        resolution TEXT,
        submittedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        resolvedAt DATETIME,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
      )
    `;

    db.query(createTableSql, (createErr) => {
      if (createErr) {
        console.error('Error creating complaints table:', createErr);
        return res.status(500).json({ error: 'Database error' });
      }

      // Lưu khiếu nại
      const insertSql = `
        INSERT INTO complaints (
          ticketId, userId, userName, userEmail, type, severity, 
          bookingId, description, evidence, contactPreference, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        complaintData.ticketId,
        complaintData.userId,
        complaintData.userName,
        complaintData.userEmail,
        complaintData.type,
        complaintData.severity,
        complaintData.bookingId || null,
        complaintData.description,
        JSON.stringify(complaintData.evidence || []),
        complaintData.contactPreference,
        'pending'
      ];

      db.query(insertSql, values, (err, result) => {
        if (err) {
          console.error('Error saving complaint:', err);
          return res.status(500).json({ error: 'Failed to save complaint' });
        }

        // Gửi email thông báo (giả lập)
        console.log(`📧 Complaint notification sent for ticket: ${complaintData.ticketId}`);

        res.json({
          success: true,
          ticketId: complaintData.ticketId,
          message: 'Complaint submitted successfully',
          complaintId: result.insertId
        });
      });
    });

  } catch (error) {
    console.error('Submit complaint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Lấy danh sách khiếu nại của user
app.get('/api/complaints/user/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    
    const sql = `
      SELECT id, ticketId, type, severity, bookingId, description, 
             status, submittedAt, updatedAt, resolvedAt
      FROM complaints 
      WHERE userId = ? 
      ORDER BY submittedAt DESC
    `;

    db.query(sql, [userId], (err, results) => {
      if (err) {
        console.error('Error fetching user complaints:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({
        success: true,
        complaints: results
      });
    });

  } catch (error) {
    console.error('Fetch user complaints error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Lấy chi tiết khiếu nại
app.get('/api/complaints/:ticketId', (req, res) => {
  try {
    const { ticketId } = req.params;
    
    const sql = `
      SELECT * FROM complaints WHERE ticketId = ?
    `;

    db.query(sql, [ticketId], (err, results) => {
      if (err) {
        console.error('Error fetching complaint details:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (results.length === 0) {
        return res.status(404).json({ error: 'Complaint not found' });
      }

      const complaint = results[0];
      // Parse JSON fields
      if (complaint.evidence) {
        complaint.evidence = JSON.parse(complaint.evidence);
      }

      res.json({
        success: true,
        complaint: complaint
      });
    });

  } catch (error) {
    console.error('Fetch complaint details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========================
// COUPON/DISCOUNT APIs
// ========================

// API: Kiểm tra mã giảm giá
app.post('/api/coupons/validate', (req, res) => {
  const { code, customerId, totalAmount } = req.body;
  
  console.log('🎫 Validating coupon:', { code, customerId, totalAmount });
  
  // Tìm coupon trong database
  const findCouponSql = `
    SELECT * FROM coupons 
    WHERE code = ? AND isActive = TRUE 
    AND (expiresAt IS NULL OR expiresAt > NOW())
  `;
  
  db.query(findCouponSql, [code.toUpperCase()], (err, couponResults) => {
    if (err) {
      console.error('Error finding coupon:', err);
      return res.status(500).json({ valid: false, message: 'Lỗi hệ thống' });
    }
    
    if (couponResults.length === 0) {
      return res.status(400).json({
        valid: false,
        message: 'Mã giảm giá không tồn tại hoặc đã hết hạn'
      });
    }
    
    const coupon = couponResults[0];
    
    // Kiểm tra số tiền tối thiểu
    if (totalAmount < coupon.minAmount) {
      return res.status(400).json({
        valid: false,
        message: `Đơn hàng tối thiểu $${coupon.minAmount} để sử dụng mã này`
      });
    }
    
    // Kiểm tra usage limit
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({
        valid: false,
        message: 'Mã giảm giá đã hết lượt sử dụng'
      });
    }
    
    // Kiểm tra nếu user đã sử dụng mã này (cho mã firstTimeOnly)
    if (customerId) {
      const checkUsageSql = `
        SELECT COUNT(*) as usageCount 
        FROM coupon_usage 
        WHERE couponId = ? AND userId = ?
      `;
      
      db.query(checkUsageSql, [coupon.id, customerId], (err, usageResults) => {
        if (err) {
          console.error('Error checking coupon usage:', err);
          return res.status(500).json({ valid: false, message: 'Lỗi hệ thống' });
        }
        
        const usageCount = usageResults[0].usageCount;
        
        if (coupon.firstTimeOnly && usageCount > 0) {
          return res.status(400).json({
            valid: false,
            message: 'Bạn đã sử dụng mã giảm giá này rồi'
          });
        }
        
        // Kiểm tra nếu là mã dành cho lần đầu
        if (coupon.firstTimeOnly) {
          const checkFirstTimeSql = `
            SELECT COUNT(*) as bookingCount 
            FROM bookings 
            WHERE customerId = ? AND status IN ('completed', 'confirmed')
          `;
          
          db.query(checkFirstTimeSql, [customerId], (err, bookingResults) => {
            if (err) {
              console.error('Error checking first time customer:', err);
              return res.status(500).json({ valid: false, message: 'Lỗi hệ thống' });
            }
            
            const bookingCount = bookingResults[0].bookingCount;
            
            if (bookingCount > 0) {
              return res.status(400).json({
                valid: false,
                message: 'Mã giảm giá chỉ dành cho khách hàng mới'
              });
            }
            
            // Tính toán giảm giá
            calculateDiscount();
          });
        } else {
          calculateDiscount();
        }
      });
    } else {
      calculateDiscount();
    }
    
    function calculateDiscount() {
      let discountAmount = 0;
      
      if (coupon.type === 'percentage') {
        discountAmount = (Number(totalAmount) * Number(coupon.discount)) / 100;
        if (coupon.maxDiscount > 0 && discountAmount > Number(coupon.maxDiscount)) {
          discountAmount = Number(coupon.maxDiscount);
        }
      } else {
        discountAmount = Number(coupon.discount);
      }
      
      // Ensure discountAmount is a valid number
      discountAmount = Number(discountAmount) || 0;
      const finalAmount = Number(totalAmount) - discountAmount;
      
      res.json({
        valid: true,
        coupon: {
          id: coupon.id,
          code: coupon.code,
          description: coupon.description,
          discount: coupon.discount,
          type: coupon.type
        },
        discountAmount: Math.round(discountAmount * 100) / 100,
        finalAmount: Math.round(finalAmount * 100) / 100,
        message: `Áp dụng thành công! Giảm $${discountAmount.toFixed(2)}`
      });
    }
  });
});

// ========================
// ADMIN COUPON MANAGEMENT APIs
// ========================

// API: Lấy tất cả coupons (Admin only)
app.get('/api/admin/coupons', (req, res) => {
  const sql = `
    SELECT * FROM coupons 
    ORDER BY createdAt DESC
  `;
  
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching coupons:', err);
      return res.status(500).json({ error: 'Lỗi lấy danh sách mã giảm giá' });
    }
    
    res.json(results);
  });
});

// API: Tạo coupon mới (Admin only)
app.post('/api/admin/coupons', (req, res) => {
  const {
    code, description, discount, type, minAmount, maxDiscount,
    firstTimeOnly, isActive, usageLimit, expiresAt
  } = req.body;
  
  console.log('🎫 Creating new coupon:', { code, description, discount, type });
  
  // Validate required fields
  if (!code || !description || !discount || !type) {
    return res.status(400).json({ 
      error: 'Thiếu thông tin bắt buộc',
      message: 'Mã, mô tả, giá trị giảm và loại giảm giá là bắt buộc'
    });
  }
  
  // Check if code already exists
  const checkCodeSql = 'SELECT id FROM coupons WHERE code = ?';
  
  db.query(checkCodeSql, [code.toUpperCase()], (err, existing) => {
    if (err) {
      console.error('Error checking coupon code:', err);
      return res.status(500).json({ error: 'Lỗi kiểm tra mã giảm giá' });
    }
    
    if (existing.length > 0) {
      return res.status(400).json({ 
        error: 'Mã giảm giá đã tồn tại',
        message: 'Vui lòng chọn mã khác'
      });
    }
    
    // Insert new coupon
    const insertSql = `
      INSERT INTO coupons (
        code, description, discount, type, minAmount, maxDiscount,
        firstTimeOnly, isActive, usageLimit, expiresAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
      code.toUpperCase(),
      description,
      Number(discount),
      type,
      minAmount ? Number(minAmount) : 0,
      maxDiscount ? Number(maxDiscount) : 0,
      Boolean(firstTimeOnly),
      Boolean(isActive),
      usageLimit ? Number(usageLimit) : null,
      expiresAt || null
    ];
    
    db.query(insertSql, values, (err, result) => {
      if (err) {
        console.error('Error creating coupon:', err);
        return res.status(500).json({ error: 'Lỗi tạo mã giảm giá' });
      }
      
      console.log('✅ Coupon created successfully:', result.insertId);
      
      res.status(201).json({
        success: true,
        message: 'Tạo mã giảm giá thành công',
        couponId: result.insertId
      });
    });
  });
});

// API: Cập nhật coupon (Admin only)
app.put('/api/admin/coupons/:id', (req, res) => {
  const couponId = req.params.id;
  const {
    code, description, discount, type, minAmount, maxDiscount,
    firstTimeOnly, isActive, usageLimit, expiresAt
  } = req.body;
  
  console.log('🎫 Updating coupon:', couponId);
  
  // Check if coupon exists
  const checkSql = 'SELECT id FROM coupons WHERE id = ?';
  
  db.query(checkSql, [couponId], (err, existing) => {
    if (err) {
      console.error('Error checking coupon:', err);
      return res.status(500).json({ error: 'Lỗi kiểm tra mã giảm giá' });
    }
    
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy mã giảm giá' });
    }
    
    // Check if code is unique (exclude current coupon)
    const checkCodeSql = 'SELECT id FROM coupons WHERE code = ? AND id != ?';
    
    db.query(checkCodeSql, [code.toUpperCase(), couponId], (err, duplicate) => {
      if (err) {
        console.error('Error checking duplicate code:', err);
        return res.status(500).json({ error: 'Lỗi kiểm tra mã giảm giá' });
      }
      
      if (duplicate.length > 0) {
        return res.status(400).json({ 
          error: 'Mã giảm giá đã tồn tại',
          message: 'Vui lòng chọn mã khác'
        });
      }
      
      // Update coupon
      const updateSql = `
        UPDATE coupons SET 
          code = ?, description = ?, discount = ?, type = ?, 
          minAmount = ?, maxDiscount = ?, firstTimeOnly = ?, 
          isActive = ?, usageLimit = ?, expiresAt = ?,
          updatedAt = NOW()
        WHERE id = ?
      `;
      
      const values = [
        code.toUpperCase(),
        description,
        Number(discount),
        type,
        minAmount ? Number(minAmount) : 0,
        maxDiscount ? Number(maxDiscount) : 0,
        Boolean(firstTimeOnly),
        Boolean(isActive),
        usageLimit ? Number(usageLimit) : null,
        expiresAt || null,
        couponId
      ];
      
      db.query(updateSql, values, (err, result) => {
        if (err) {
          console.error('Error updating coupon:', err);
          return res.status(500).json({ error: 'Lỗi cập nhật mã giảm giá' });
        }
        
        console.log('✅ Coupon updated successfully:', couponId);
        
        res.json({
          success: true,
          message: 'Cập nhật mã giảm giá thành công'
        });
      });
    });
  });
});

// API: Xóa coupon (Admin only)
app.delete('/api/admin/coupons/:id', (req, res) => {
  const couponId = req.params.id;
  
  console.log('🗑️ Deleting coupon:', couponId);
  
  // Check if coupon has been used
  const checkUsageSql = 'SELECT COUNT(*) as usageCount FROM coupon_usage WHERE couponId = ?';
  
  db.query(checkUsageSql, [couponId], (err, usage) => {
    if (err) {
      console.error('Error checking coupon usage:', err);
      return res.status(500).json({ error: 'Lỗi kiểm tra sử dụng mã giảm giá' });
    }
    
    const usageCount = usage[0].usageCount;
    
    if (usageCount > 0) {
      // If coupon has been used, just deactivate it instead of deleting
      const deactivateSql = 'UPDATE coupons SET isActive = FALSE, updatedAt = NOW() WHERE id = ?';
      
      db.query(deactivateSql, [couponId], (err, result) => {
        if (err) {
          console.error('Error deactivating coupon:', err);
          return res.status(500).json({ error: 'Lỗi vô hiệu hóa mã giảm giá' });
        }
        
        res.json({
          success: true,
          message: 'Mã giảm giá đã được vô hiệu hóa (do đã có người sử dụng)'
        });
      });
    } else {
      // If coupon hasn't been used, delete it completely
      const deleteSql = 'DELETE FROM coupons WHERE id = ?';
      
      db.query(deleteSql, [couponId], (err, result) => {
        if (err) {
          console.error('Error deleting coupon:', err);
          return res.status(500).json({ error: 'Lỗi xóa mã giảm giá' });
        }
        
        if (result.affectedRows === 0) {
          return res.status(404).json({ error: 'Không tìm thấy mã giảm giá' });
        }
        
        console.log('✅ Coupon deleted successfully:', couponId);
        
        res.json({
          success: true,
          message: 'Xóa mã giảm giá thành công'
        });
      });
    }
  });
});

// API: Lưu coupon usage khi booking thành công
app.post('/api/coupons/use', (req, res) => {
  const { couponId, userId, bookingId, discountAmount } = req.body;
  
  console.log('💰 Recording coupon usage:', { couponId, userId, bookingId, discountAmount });
  
  // Lưu coupon usage
  const insertUsageSql = `
    INSERT INTO coupon_usage (couponId, userId, bookingId, discountAmount) 
    VALUES (?, ?, ?, ?)
  `;
  
  db.query(insertUsageSql, [couponId, userId, bookingId, discountAmount], (err, result) => {
    if (err) {
      console.error('Error recording coupon usage:', err);
      return res.status(500).json({ error: 'Lỗi lưu thông tin sử dụng coupon' });
    }
    
    // Cập nhật usedCount trong bảng coupons
    const updateCountSql = `
      UPDATE coupons 
      SET usedCount = usedCount + 1, updatedAt = NOW() 
      WHERE id = ?
    `;
    
    db.query(updateCountSql, [couponId], (err) => {
      if (err) {
        console.error('Error updating coupon count:', err);
      }
    });
    
    res.json({
      success: true,
      message: 'Đã ghi nhận sử dụng mã giảm giá',
      usageId: result.insertId
    });
  });
});

const PORT = Number(process.env.PORT) || 5000;

let shutdownStarted = false;
function gracefulShutdown(reason) {
  if (shutdownStarted) return;
  shutdownStarted = true;
  console.log(`Shutting down (${reason}), releasing port ${PORT} and MySQL connection...`);
  try {
    if (typeof io.disconnectSockets === 'function') {
      io.disconnectSockets(true);
    }
  } catch (e) {
    console.error('Socket.IO disconnect:', e);
  }
  server.close((closeErr) => {
    if (closeErr) console.error('HTTP server.close:', closeErr);
    db.end((dbErr) => {
      if (dbErr) console.error('MySQL connection end:', dbErr);
      process.exit(closeErr || dbErr ? 1 : 0);
    });
  });
  setTimeout(() => {
    console.error('Shutdown timeout, forcing exit');
    process.exit(1);
  }, 8000).unref();
}

process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.once('SIGINT', () => gracefulShutdown('SIGINT'));

server.listen(PORT, () =>
  console.log(`Server running on port ${PORT} with WebSocket support`)
);
