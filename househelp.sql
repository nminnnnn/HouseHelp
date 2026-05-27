-- Set charset and SQL mode for compatibility
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";

-- Drop existing tables
DROP TABLE IF EXISTS system_logs;
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS coupon_usage;
DROP TABLE IF EXISTS coupons;
DROP TABLE IF EXISTS chat_read_status;
DROP TABLE IF EXISTS verification_documents;
DROP TABLE IF EXISTS verification_requests;
DROP TABLE IF EXISTS file_uploads;
DROP TABLE IF EXISTS recurring_bookings;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS housekeeper_services;
DROP TABLE IF EXISTS housekeepers;
DROP TABLE IF EXISTS services;
DROP TABLE IF EXISTS users;

-- ========================
-- users
-- ========================
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fullName VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255),
  phone VARCHAR(20),
  role ENUM('customer','housekeeper','admin') DEFAULT 'customer',
  idCardFront LONGTEXT,
  idCardBack LONGTEXT,
  avatar VARCHAR(255),
  dateOfBirth DATE,
  gender ENUM('male','female','other'),
  address TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  city VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  district VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  bio TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  languages VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  emergencyContact VARCHAR(20),
  emergencyContactName VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  isVerified BOOLEAN DEFAULT FALSE,
  isApproved BOOLEAN DEFAULT FALSE,
  verifiedAt DATETIME,
  lastActiveAt DATETIME,
  -- Google OAuth fields
  googleId VARCHAR(255) UNIQUE,
  authProvider ENUM('local','google') DEFAULT 'local',
  profilePicture VARCHAR(500),
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ========================
-- housekeepers
-- ========================
CREATE TABLE housekeepers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  rating FLOAT DEFAULT 0,
  totalReviews INT DEFAULT 0,
  services VARCHAR(500),
  price DECIMAL(10,2),
  priceType ENUM('hourly','daily','per_service') DEFAULT 'hourly',
  available BOOLEAN DEFAULT TRUE,
  description TEXT,
  experience INT DEFAULT 0,
  skills JSON,
  certifications JSON,
  workingDays JSON,
  workingHours VARCHAR(50),
  serviceRadius INT DEFAULT 10,
  profileImages JSON,
  hasInsurance BOOLEAN DEFAULT FALSE,
  insuranceInfo TEXT,
  specialOffers JSON,
  completedJobs INT DEFAULT 0,
  responseTime INT DEFAULT 60,
  cancellationRate FLOAT DEFAULT 0,
  isTopRated BOOLEAN DEFAULT FALSE,
  badges JSON,
  lastOnline DATETIME,
  -- Quick Booking related fields
  backgroundChecked BOOLEAN DEFAULT FALSE,
  insured BOOLEAN DEFAULT FALSE,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ========================
-- services
-- ========================
CREATE TABLE services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci UNIQUE,
  description TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  icon VARCHAR(100),
  isActive BOOLEAN DEFAULT TRUE,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ========================
-- housekeeper_services
-- ========================
CREATE TABLE housekeeper_services (
  housekeeperId INT,
  serviceId INT,
  priceOverride DECIMAL(10,2),
  PRIMARY KEY (housekeeperId, serviceId),
  FOREIGN KEY (housekeeperId) REFERENCES housekeepers(id) ON DELETE CASCADE,
  FOREIGN KEY (serviceId) REFERENCES services(id) ON DELETE CASCADE
);

-- ========================
-- bookings (giữ nguyên startDate, endDate, totalPrice)
-- ========================
CREATE TABLE bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customerId INT NOT NULL,
  housekeeperId INT NOT NULL,
  serviceId INT,
  startDate DATETIME NOT NULL,
  endDate DATETIME,
  status ENUM('pending','confirmed','in_progress','completed','cancelled','rejected') DEFAULT 'pending',
  paymentStatus ENUM('pending','success','failed') DEFAULT 'pending',
  totalPrice DECIMAL(10,2),
  notes TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  customerAddress TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- Cột bổ sung cho tiện ích
  time VARCHAR(10),
  duration INT DEFAULT 2,
  location TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  customerName VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  customerEmail VARCHAR(255),
  customerPhone VARCHAR(20),
  housekeeperName VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  service VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  -- Quick Booking columns
  urgency ENUM('normal', 'urgent', 'asap') DEFAULT 'normal',
  isQuickBooking BOOLEAN DEFAULT FALSE,
  matchScore INT DEFAULT 0,
  FOREIGN KEY (customerId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (housekeeperId) REFERENCES housekeepers(id) ON DELETE CASCADE,
  FOREIGN KEY (serviceId) REFERENCES services(id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ========================
-- reviews
-- ========================
CREATE TABLE reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bookingId INT,
  housekeeperId INT NOT NULL,
  customerId INT NOT NULL,
  rating INT CHECK (rating BETWEEN 1 AND 5),
  comment TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  isVisible BOOLEAN DEFAULT TRUE,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bookingId) REFERENCES bookings(id) ON DELETE SET NULL,
  FOREIGN KEY (housekeeperId) REFERENCES housekeepers(id) ON DELETE CASCADE,
  FOREIGN KEY (customerId) REFERENCES users(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ========================
-- notifications
-- ========================
CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  type VARCHAR(50) NOT NULL,
  urgency ENUM('normal', 'urgent', 'asap') DEFAULT 'normal',
  title VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  message TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  bookingId INT NULL,
  data JSON NULL,
  read_status TINYINT(1) DEFAULT 0,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_userId (userId),
  INDEX idx_createdAt (createdAt),
  INDEX idx_read_status (read_status),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (bookingId) REFERENCES bookings(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ========================
-- reports (báo cáo vi phạm)
-- ========================
CREATE TABLE reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bookingId INT NOT NULL,
  customerId INT NOT NULL,
  housekeeperId INT NOT NULL,
  reportType ENUM('late_arrival','no_show','inappropriate_behavior','poor_service','damage','other') NOT NULL,
  title VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  description TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  evidence TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci, -- URLs của ảnh/video bằng chứng
  status ENUM('pending','investigating','resolved','dismissed') DEFAULT 'pending',
  adminResponse TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  severity ENUM('low','medium','high','critical') DEFAULT 'medium',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  resolvedAt DATETIME NULL,
  FOREIGN KEY (bookingId) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (customerId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (housekeeperId) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_status (status),
  INDEX idx_reportType (reportType),
  INDEX idx_severity (severity),
  INDEX idx_createdAt (createdAt)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ========================
-- warnings (cảnh cáo housekeeper)
-- ========================
CREATE TABLE warnings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  housekeeperId INT NOT NULL,
  reportId INT NOT NULL,
  adminId INT NOT NULL,
  warningType ENUM('verbal','written','final','suspension') DEFAULT 'written',
  title VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  message TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  severity ENUM('low','medium','high','critical') DEFAULT 'medium',
  isRead BOOLEAN DEFAULT FALSE,
  expiresAt DATETIME NULL, -- Cho suspension warnings
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  readAt DATETIME NULL,
  FOREIGN KEY (housekeeperId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reportId) REFERENCES reports(id) ON DELETE CASCADE,
  FOREIGN KEY (adminId) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_housekeeperId (housekeeperId),
  INDEX idx_createdAt (createdAt),
  INDEX idx_warningType (warningType),
  INDEX idx_isRead (isRead)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ========================
-- payments (mới)
-- ========================
CREATE TABLE payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bookingId INT NOT NULL,
  customerId INT NOT NULL,
  method ENUM('cash','credit_card','bank_transfer','e_wallet') NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status ENUM('pending','success','failed','refunded') DEFAULT 'pending',
  transactionCode VARCHAR(100),
  paidAt DATETIME,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bookingId) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (customerId) REFERENCES users(id) ON DELETE CASCADE
);

-- ========================
-- chat_messages (mới)
-- ========================
CREATE TABLE chat_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bookingId INT NOT NULL,
  senderId INT NOT NULL,
  receiverId INT NOT NULL,
  message TEXT,
  messageType ENUM('text','image','file') DEFAULT 'text',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bookingId) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiverId) REFERENCES users(id) ON DELETE CASCADE
);

-- ========================
-- recurring_bookings (mới)
-- ========================
CREATE TABLE recurring_bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customerId INT NOT NULL,
  housekeeperId INT,
  serviceId INT,
  frequency ENUM('daily','weekly','monthly') NOT NULL,
  startDate DATE NOT NULL,
  endDate DATE,
  nextBookingDate DATE,
  status ENUM('active','paused','cancelled') DEFAULT 'active',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customerId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (housekeeperId) REFERENCES housekeepers(id) ON DELETE SET NULL,
  FOREIGN KEY (serviceId) REFERENCES services(id) ON DELETE SET NULL
);

-- ========================
-- system_logs (mới)
-- ========================
CREATE TABLE system_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT,
  action VARCHAR(100),
  description TEXT,
  ipAddress VARCHAR(50),
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
);

-- ========================
-- file_uploads (mới)
-- ========================
CREATE TABLE file_uploads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  fileName VARCHAR(255) NOT NULL,
  originalName VARCHAR(255) NOT NULL,
  filePath VARCHAR(500) NOT NULL,
  fileType ENUM('avatar','id_card_front','id_card_back','profile_image','document') NOT NULL,
  mimeType VARCHAR(100),
  fileSize INT,
  uploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_userId_fileType (userId, fileType)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ========================
-- Sample Data (tương thích)
-- ========================
INSERT INTO services (name, description, icon) VALUES
('Dọn dẹp nhà cửa', 'Vệ sinh tổng thể nhà cửa, lau chùi, hút bụi', 'home-cleaning'),
('Giặt ủi quần áo', 'Giặt, ủi và sắp xếp quần áo gọn gàng', 'laundry'),
('Nấu ăn', 'Chuẩn bị và nấu các bữa ăn theo yêu cầu', 'cooking'),
('Chăm sóc trẻ em', 'Trông trẻ, chơi và chăm sóc trẻ em', 'childcare'),
('Chăm sóc người già', 'Hỗ trợ và chăm sóc người cao tuổi', 'eldercare'),
('Vệ sinh công nghiệp', 'Vệ sinh văn phòng, nhà xưởng quy mô lớn', 'industrial-cleaning'),
('Làm vườn', 'Chăm sóc cây cối, tỉa cành, tưới nước', 'gardening');

INSERT INTO users (fullName, email, password, phone, role, avatar, dateOfBirth, gender, address, city, district, bio, languages, emergencyContact, emergencyContactName, isVerified, isApproved) VALUES
('Nguyễn Thị Lan', 'lan.nguyen@email.com', SHA2('123456', 256), '0901234567', 'housekeeper', '/avatars/lan-nguyen.jpg', '1990-05-15', 'female', '123 Đường ABC, Phường 1', 'TP.HCM', 'Quận 1', 'Tôi có 5 năm kinh nghiệm làm việc nhà và luôn tận tâm với công việc.', 'Tiếng Việt, Tiếng Anh', '0987654321', 'Nguyễn Văn Nam', TRUE, TRUE),
('Trần Văn Minh', 'minh.tran@email.com', SHA2('123456', 256), '0912345678', 'housekeeper', '/avatars/minh-tran.jpg', '1985-08-20', 'male', '456 Đường XYZ, Phường 2', 'TP.HCM', 'Quận 3', 'Chuyên về vệ sinh công nghiệp và làm sạch nhà cửa.', 'Tiếng Việt', '0976543210', 'Trần Thị Mai', TRUE, TRUE),
('Lê Thị Hoa', 'hoa.le@email.com', SHA2('123456', 256), '0923456789', 'customer', '/avatars/hoa-le.jpg', '1992-12-10', 'female', '789 Đường DEF, Phường 3', 'TP.HCM', 'Quận 7', 'Tôi là khách hàng thường xuyên sử dụng dịch vụ giúp việc.', 'Tiếng Việt', '0965432109', 'Lê Văn Đức', FALSE, FALSE),
('Phạm Văn Tuấn', 'tuan.pham@email.com', SHA2('123456', 256), '0934567890', 'customer', '/avatars/tuan-pham.jpg', '1988-03-25', 'male', '321 Đường GHI, Phường 4', 'Hà Nội', 'Quận Ba Đình', 'Chủ nhà thường xuyên cần dịch vụ vệ sinh.', 'Tiếng Việt, Tiếng Anh', '0954321098', 'Phạm Thị Lan', FALSE, FALSE),
('Admin System', 'admin@househelp.com', SHA2('admin123', 256), '0999999999', 'admin', '/avatars/admin.jpg', '1990-01-01', 'male', 'Trụ sở chính', 'Hà Nội', 'Cầu Giấy', 'Quản trị hệ thống HouseHelp', 'Tiếng Việt', NULL, NULL, TRUE, TRUE);

INSERT INTO housekeepers (userId, rating, totalReviews, services, price, priceType, description, experience, skills, certifications, workingDays, workingHours, serviceRadius, profileImages, hasInsurance, completedJobs, responseTime, isTopRated, backgroundChecked, insured) VALUES
(1, 4.8, 127, 'Vệ sinh nhà cửa, Giặt ủi, Nấu ăn', 25.00, 'hourly', 'Tôi có 5 năm kinh nghiệm trong lĩnh vực giúp việc nhà.', 5, 
JSON_ARRAY('Vệ sinh chuyên nghiệp', 'Nấu ăn ngon', 'Chăm sóc trẻ em', 'Giặt ủi'), 
JSON_ARRAY('Chứng chỉ vệ sinh an toàn thực phẩm', 'Chứng chỉ sơ cấp cứu'), 
JSON_ARRAY('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'), 
'07:00-19:00', 15, JSON_ARRAY('/portfolio/lan-1.jpg','/portfolio/lan-2.jpg'), TRUE, 95, 15, TRUE, TRUE, TRUE),

(2, 4.5, 89, 'Vệ sinh công nghiệp, Vệ sinh nhà cửa', 30.00, 'hourly', 'Chuyên về vệ sinh công nghiệp và vệ sinh nhà ở.', 8, 
JSON_ARRAY('Vệ sinh công nghiệp','Vệ sinh kính','Vệ sinh thảm','Bảo trì thiết bị'), 
JSON_ARRAY('Chứng chỉ vệ sinh công nghiệp','Chứng chỉ an toàn lao động'), 
JSON_ARRAY('Monday','Tuesday','Wednesday','Thursday','Friday'), 
'08:00-17:00', 20, JSON_ARRAY('/portfolio/minh-1.jpg','/portfolio/minh-2.jpg','/portfolio/minh-3.jpg'), TRUE, 156, 20, FALSE, TRUE, TRUE);

INSERT INTO housekeeper_services (housekeeperId, serviceId) VALUES
(1,1),(1,2),(1,3),(1,4),
(2,1),(2,6);

INSERT INTO bookings (customerId, housekeeperId, serviceId, startDate, endDate, status, totalPrice, notes, customerAddress, time, duration, location, customerName, customerEmail, customerPhone, housekeeperName, service, urgency, isQuickBooking, matchScore) VALUES
(3,1,1,'2025-09-15 09:00:00','2025-09-15 12:00:00','confirmed',85.00,'Cần dọn dẹp phòng khách và bếp','Quận 7, TP.HCM','09:00',3,'Quận 7, TP.HCM','Lê Thị Hoa','hoa.le@email.com','0923456789','Nguyễn Thị Lan','Dọn dẹp nhà cửa','normal',FALSE,0),
(4,2,6,'2025-09-16 14:00:00','2025-09-16 18:00:00','pending',130.00,'Làm sạch văn phòng nhỏ - Đặt nhanh','Quận Ba Đình, Hà Nội','14:00',4,'Quận Ba Đình, Hà Nội','Phạm Văn Tuấn','tuan.pham@email.com','0934567890','Trần Văn Minh','Vệ sinh công nghiệp','urgent',TRUE,95);

INSERT INTO reviews (bookingId, housekeeperId, customerId, rating, comment) VALUES
(1,1,3,5,'Rất hài lòng, chị Lan làm việc cẩn thận và sạch sẽ'),
(2,2,4,4,'Anh Minh làm tốt, nhưng cần cải thiện tốc độ một chút');

INSERT INTO payments (bookingId, customerId, method, amount, status, transactionCode, paidAt) VALUES
(1,3,'e_wallet',240000,'success','TXN123456','2025-09-15 11:30:00'),
(2,4,'cash',280000,'pending',NULL,NULL);

INSERT INTO chat_messages (bookingId, senderId, receiverId, message, messageType) VALUES
(1,3,1,'Chị Lan ơi, ngày mai chị đến đúng 9h nhé?','text'),
(1,1,3,'Ok em, chị sẽ có mặt đúng giờ!','text'),
(2,4,2,'Anh Minh, có thể mang theo dụng cụ vệ sinh kính không?','text');

INSERT INTO recurring_bookings (customerId, housekeeperId, serviceId, frequency, startDate, endDate, nextBookingDate, status) VALUES
(3,1,1,'weekly','2025-09-20','2025-12-20','2025-09-27','active'),
(4,2,6,'monthly','2025-09-25','2026-03-25','2025-10-25','active');

INSERT INTO system_logs (userId, action, description, ipAddress) VALUES
(5,'LOGIN','Admin đăng nhập hệ thống','192.168.1.10'),
(1,'UPDATE_PROFILE','Nguyễn Thị Lan cập nhật thông tin hồ sơ','192.168.1.15'),
(3,'BOOKING_CREATED','Lê Thị Hoa tạo đơn đặt dịch vụ dọn dẹp','192.168.1.20');

-- ========================
-- COMPLETION & PAYMENT DATA
-- ========================

-- Cập nhật một số booking thành trạng thái confirmed để test completion
UPDATE bookings SET status = 'confirmed' WHERE id IN (1, 2);

-- Thêm booking mẫu với trạng thái completed để test payment
INSERT INTO bookings (customerId, housekeeperId, serviceId, startDate, endDate, status, paymentStatus, totalPrice, notes, customerAddress, time, duration, location, customerName, customerEmail, customerPhone, housekeeperName, service, urgency, isQuickBooking, matchScore, createdAt) VALUES
(3, 1, 1, '2025-10-17 10:00:00', '2025-10-17 13:00:00', 'completed', 'success', 85.00, 'Đã hoàn thành dọn dẹp nhà cửa', 'Quận 7, TP.HCM', '10:00', 3, 'Quận 7, TP.HCM', 'Lê Thị Hoa', 'hoa.le@email.com', '0923456789', 'Nguyễn Thị Lan', 'Dọn dẹp nhà cửa', 'normal', FALSE, 0, NOW()),
(4, 2, 2, '2025-10-17 14:00:00', '2025-10-17 17:00:00', 'completed', 'pending', 100.00, 'Đã hoàn thành giặt ủi quần áo - Đặt nhanh', 'Quận Ba Đình, Hà Nội', '14:00', 3, 'Quận Ba Đình, Hà Nội', 'Phạm Văn Tuấn', 'tuan.pham@email.com', '0934567890', 'Trần Văn Minh', 'Giặt ủi quần áo', 'asap', TRUE, 88, NOW());

-- Thêm payment records cho các booking completed
INSERT INTO payments (bookingId, customerId, method, amount, status, transactionCode, paidAt, createdAt) VALUES
-- Payment cho booking vừa hoàn thành
((SELECT MAX(id)-1 FROM bookings), 3, 'e_wallet', 85.00, 'success', CONCAT('PAY_', UNIX_TIMESTAMP()), NOW(), NOW()),
((SELECT MAX(id) FROM bookings), 4, 'bank_transfer', 100.00, 'success', CONCAT('PAY_', UNIX_TIMESTAMP()), NOW(), NOW()),
-- Payment cho booking cũ
(1, 3, 'cash', 85.00, 'success', 'PAY_CASH_001', NOW(), NOW());

-- Cập nhật completedJobs cho housekeepers
UPDATE housekeepers SET 
  completedJobs = completedJobs + 2,
  updatedAt = NOW()
WHERE id = 1; -- Nguyễn Thị Lan

UPDATE housekeepers SET 
  completedJobs = completedJobs + 1,
  updatedAt = NOW()
WHERE id = 2; -- Trần Văn Minh

-- Thêm reviews cho các booking đã hoàn thành
INSERT INTO reviews (bookingId, housekeeperId, customerId, rating, comment, createdAt) VALUES
((SELECT MAX(id)-1 FROM bookings), 1, 3, 5, 'Dịch vụ tuyệt vời! Nhà cửa sạch sẽ và gọn gàng. Sẽ sử dụng lại dịch vụ.', NOW()),
((SELECT MAX(id) FROM bookings), 2, 4, 4, 'Làm việc chuyên nghiệp, quần áo được giặt sạch và ủi phẳng. Hài lòng với dịch vụ.', NOW()),
(1, 1, 3, 5, 'Chị Lan làm việc rất tận tâm và cẩn thận. Highly recommended!', NOW());

-- Cập nhật rating trung bình cho housekeepers
UPDATE housekeepers h SET 
  rating = (SELECT AVG(r.rating) FROM reviews r WHERE r.housekeeperId = h.id),
  totalReviews = (SELECT COUNT(*) FROM reviews r WHERE r.housekeeperId = h.id),
  updatedAt = NOW()
WHERE h.id IN (1, 2);

-- Thêm notifications cho completion & payment flow
INSERT INTO notifications (userId, type, urgency, title, message, bookingId, data, createdAt, read_status) VALUES
-- Notification cho customer khi housekeeper hoàn thành
(3, 'booking_completed', 'normal', 'Công việc đã hoàn thành', 'Nguyễn Thị Lan đã hoàn thành công việc. Vui lòng xác nhận và thanh toán.', (SELECT MAX(id)-1 FROM bookings), '{"paymentRequired": true}', NOW(), 0),
(4, 'booking_completed', 'urgent', 'Công việc đã hoàn thành', 'Trần Văn Minh đã hoàn thành công việc khẩn cấp. Vui lòng xác nhận và thanh toán.', (SELECT MAX(id) FROM bookings), '{"paymentRequired": true, "isQuickBooking": true}', NOW(), 0),

-- Notification cho housekeeper khi nhận được thanh toán
(1, 'payment_received', 'normal', 'Đã nhận thanh toán', 'Lê Thị Hoa đã xác nhận và thanh toán $85.00', (SELECT MAX(id)-1 FROM bookings), '{"amount": 85.00, "method": "e_wallet"}', NOW(), 0),
(2, 'payment_received', 'normal', 'Đã nhận thanh toán', 'Phạm Văn Tuấn đã xác nhận và thanh toán $100.00', (SELECT MAX(id) FROM bookings), '{"amount": 100.00, "method": "bank_transfer"}', NOW(), 0),

-- Quick Booking notifications
(1, 'quick_booking', 'urgent', '⚡ Đơn đặt lịch GẤP!', 'Phạm Văn Tuấn cần dịch vụ Vệ sinh công nghiệp trong 6h tới', 2, '{"urgency": "urgent", "isQuickBooking": true, "matchScore": 95}', NOW(), 0),
(2, 'quick_booking', 'asap', '🚨 Đơn đặt lịch KHẨN CẤP!', 'Khách hàng cần dịch vụ Giặt ủi quần áo NGAY LẬP TỨC!', 4, '{"urgency": "asap", "isQuickBooking": true, "matchScore": 88}', NOW(), 0),
(1, 'quick_booking', 'normal', '📋 Đơn đặt lịch nhanh mới', 'Lê Thị Hoa đã đặt lịch dịch vụ Dọn dẹp nhà cửa (Đặt nhanh)', 1, '{"urgency": "normal", "isQuickBooking": true, "matchScore": 92}', NOW(), 0),
(2, 'quick_booking', 'urgent', '⚡ Đơn đặt lịch GẤP!', 'Khách hàng cần dịch vụ Vệ sinh công nghiệp trong 6h tới', 2, '{"urgency": "urgent", "isQuickBooking": true, "matchScore": 85}', NOW(), 0),
(1, 'quick_booking', 'asap', '🚨 Đơn đặt lịch KHẨN CẤP!', 'Lê Thị Hoa cần dịch vụ Chăm sóc trẻ em NGAY LẬP TỨC!', 3, '{"urgency": "asap", "isQuickBooking": true, "matchScore": 98}', NOW(), 0);

-- Thêm quick bookings mẫu
INSERT INTO bookings (customerId, housekeeperId, serviceId, startDate, endDate, status, paymentStatus, totalPrice, notes, customerAddress, time, duration, location, customerName, customerEmail, customerPhone, housekeeperName, service, urgency, isQuickBooking, matchScore, createdAt) VALUES
-- Quick booking với Nguyễn Thị Lan
(3, 1, 1, '2025-12-01 10:00:00', '2025-12-01 13:00:00', 'pending', 'pending', 115.00, 'Cần dọn dẹp tổng thể - Đặt nhanh', 'Quận 7, TP.HCM', '10:00', 3, 'Quận 7, TP.HCM', 'Lê Thị Hoa', 'hoa.le@email.com', '0923456789', 'Nguyễn Thị Lan', 'Dọn dẹp nhà cửa', 'normal', TRUE, 92, NOW()),

-- Quick booking khẩn cấp với Trần Văn Minh
(4, 2, 6, '2025-12-01 14:00:00', '2025-12-01 16:00:00', 'pending', 'pending', 90.00, 'Cần vệ sinh công nghiệp gấp - Đặt nhanh', 'Quận Ba Đình, Hà Nội', '14:00', 2, 'Quận Ba Đình, Hà Nội', 'Phạm Văn Tuấn', 'tuan.pham@email.com', '0934567890', 'Trần Văn Minh', 'Vệ sinh công nghiệp', 'urgent', TRUE, 85, NOW()),

-- Quick booking ASAP với Nguyễn Thị Lan
(3, 1, 4, '2025-12-01 16:00:00', '2025-12-01 20:00:00', 'confirmed', 'pending', 190.00, 'Cần chăm sóc trẻ em khẩn cấp - Đặt nhanh', 'Quận 7, TP.HCM', '16:00', 4, 'Quận 7, TP.HCM', 'Lê Thị Hoa', 'hoa.le@email.com', '0923456789', 'Nguyễn Thị Lan', 'Chăm sóc trẻ em', 'asap', TRUE, 98, NOW());

-- Thêm system logs cho completion & payment activities
INSERT INTO system_logs (userId, action, description, ipAddress, createdAt) VALUES
(1, 'BOOKING_COMPLETED', 'Housekeeper đánh dấu booking hoàn thành', '192.168.1.25', NOW()),
(2, 'BOOKING_COMPLETED', 'Housekeeper đánh dấu booking hoàn thành', '192.168.1.26', NOW()),
(3, 'PAYMENT_CONFIRMED', 'Customer xác nhận thanh toán booking', '192.168.1.30', NOW()),
(4, 'PAYMENT_CONFIRMED', 'Customer xác nhận thanh toán booking', '192.168.1.31', NOW()),
(5, 'ADMIN_VIEW_STATS', 'Admin xem thống kê doanh thu', '192.168.1.10', NOW()),
-- Quick booking logs
(3, 'QUICK_BOOKING_CREATED', 'Customer tạo quick booking', '192.168.1.35', NOW()),
(4, 'QUICK_BOOKING_CREATED', 'Customer tạo quick booking khẩn cấp', '192.168.1.36', NOW()),
(1, 'QUICK_BOOKING_CONFIRMED', 'Housekeeper xác nhận quick booking ASAP', '192.168.1.37', NOW());

-- Bảng trạng thái đọc tin nhắn
CREATE TABLE `chat_read_status` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userId` int(11) NOT NULL,
  `bookingId` int(11) NOT NULL,
  `lastReadAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_booking` (`userId`, `bookingId`),
  KEY `idx_userId` (`userId`),
  KEY `idx_bookingId` (`bookingId`),
  CONSTRAINT `fk_chat_read_user` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_chat_read_booking` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================
-- VERIFICATION QUERIES  
-- ========================

-- Kiểm tra dữ liệu completion & payment (queries riêng biệt để tránh lỗi collation)

-- Booking status
-- SELECT 'BOOKING STATUS' as info, status, COUNT(*) as count FROM bookings GROUP BY status;

-- Payment status  
-- SELECT 'PAYMENT STATUS' as info, status, COUNT(*) as count FROM payments GROUP BY status;

-- Total revenue
-- SELECT 'TOTAL REVENUE' as info, 'success' as status, COALESCE(SUM(amount), 0) as count FROM payments WHERE status = 'success';

-- Today revenue
-- SELECT 'TODAY REVENUE' as info, 'today' as status, COALESCE(SUM(amount), 0) as count FROM payments WHERE DATE(paidAt) = CURRENT_DATE AND status = 'success';

-- Completed jobs
-- SELECT 'COMPLETED JOBS' as info, 'housekeeper_1' as status, COALESCE(completedJobs, 0) as count FROM housekeepers WHERE id = 1;
-- SELECT 'COMPLETED JOBS' as info, 'housekeeper_2' as status, COALESCE(completedJobs, 0) as count FROM housekeepers WHERE id = 2;

-- Average ratings
-- SELECT 'AVG RATING' as info, 'housekeeper_1' as status, COALESCE(rating, 0) as count FROM housekeepers WHERE id = 1;
-- SELECT 'AVG RATING' as info, 'housekeeper_2' as status, COALESCE(rating, 0) as count FROM housekeepers WHERE id = 2;

-- ========================
-- DATABASE UPDATE COMMANDS
-- ========================

-- paymentStatus đã có trong CREATE TABLE bookings; không dùng ADD COLUMN IF NOT EXISTS (MySQL init/docker có thể báo lỗi cú pháp).

-- Cập nhật paymentStatus cho các booking đã có payment thành công
UPDATE bookings b 
SET paymentStatus = 'success' 
WHERE EXISTS (
    SELECT 1 FROM payments p 
    WHERE p.bookingId = b.id AND p.status = 'success'
);

-- Cập nhật trạng thái xác minh cho các housekeeper mẫu (để test)
UPDATE users SET isVerified = 1, isApproved = 1 WHERE role = 'housekeeper';

-- Kiểm tra kết quả cập nhật
SELECT 'PAYMENT STATUS UPDATE' as info, 
       id, status, paymentStatus, totalPrice 
FROM bookings 
WHERE status = 'completed' 
ORDER BY id DESC;

-- ========================
-- PACKAGE.JSON DEPENDENCIES UPDATE
-- ========================
-- Add these to backend/package.json dependencies:
-- "multer": "^1.4.5-lts.1"

-- ========================
-- GOOGLE OAUTH SETUP INSTRUCTIONS
-- ========================
-- 1. Go to Google Cloud Console: https://console.cloud.google.com/
-- 2. Create a new project or select existing project
-- 3. Enable Google+ API and Google Identity Services
-- 4. Create OAuth 2.0 credentials
-- 5. Add authorized origins: http://localhost:3000, http://localhost:5174
-- 6. Replace client_id in GoogleAuthButton.jsx with your actual client ID

-- ========================
-- VERIFICATION DOCUMENTS TABLE
-- ========================
CREATE TABLE verification_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  documentType ENUM('id_card_front','id_card_back','certificate','license','insurance','other') NOT NULL,
  filePath VARCHAR(500) NOT NULL,
  originalName VARCHAR(255) NOT NULL,
  status ENUM('pending','approved','rejected') DEFAULT 'pending',
  adminNotes TEXT,
  reviewedBy INT NULL,
  reviewedAt DATETIME NULL,
  uploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewedBy) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_status (userId, status),
  INDEX idx_status_type (status, documentType)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ========================
-- VERIFICATION REQUESTS TABLE  
-- ========================
CREATE TABLE verification_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  requestType ENUM('initial_verification','document_update','resubmission') DEFAULT 'initial_verification',
  status ENUM('pending','under_review','approved','rejected','requires_more_info') DEFAULT 'pending',
  submittedDocuments JSON,
  adminNotes TEXT,
  userNotes TEXT,
  priority ENUM('low','normal','high','urgent') DEFAULT 'normal',
  assignedTo INT NULL,
  submittedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewedAt DATETIME NULL,
  completedAt DATETIME NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assignedTo) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_status_priority (status, priority),
  INDEX idx_assigned_status (assignedTo, status)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ========================
-- ADDITIONAL INDEXES FOR PERFORMANCE
-- ========================
CREATE INDEX idx_users_email_auth ON users(email, authProvider);
CREATE INDEX idx_users_google_id ON users(googleId);
CREATE INDEX idx_users_verification_status ON users(isVerified, isApproved, role);
CREATE INDEX idx_file_uploads_user_type ON file_uploads(userId, fileType);

-- Quick Booking indexes
CREATE INDEX idx_bookings_quick ON bookings(isQuickBooking, urgency, createdAt);
CREATE INDEX idx_housekeepers_matching ON housekeepers(price, available, backgroundChecked, insured);
CREATE INDEX idx_housekeeper_services_lookup ON housekeeper_services(housekeeperId, serviceId);
CREATE INDEX idx_notifications_urgency ON notifications(urgency, type, createdAt);

-- ========================
-- SAMPLE GOOGLE OAUTH USER
-- ========================
INSERT INTO users (fullName, email, googleId, authProvider, profilePicture, role, isVerified, isApproved, createdAt) VALUES
('Google Test User', 'googleuser@gmail.com', 'google_123456789', 'google', 'https://lh3.googleusercontent.com/a/default-user', 'customer', 1, 1, NOW());

-- ========================
-- SAMPLE VERIFICATION DATA
-- ========================

-- Thêm housekeeper chưa được xác thực (tùy chọn)
INSERT INTO users (fullName, email, password, phone, role, address, city, district, isVerified, isApproved, createdAt) VALUES
('Nguyễn Văn Tân', 'tan.nguyen@email.com', SHA2('123456', 256), '0945678901', 'housekeeper', '789 Đường PQR, Phường 5', 'TP.HCM', 'Quận 10', 0, 0, NOW()),
('Lê Thị Mai', 'mai.le@email.com', SHA2('123456', 256), '0956789012', 'housekeeper', '321 Đường STU, Phường 6', 'Hà Nội', 'Quận Đống Đa', 0, 0, NOW());

-- Tạo housekeeper records cho users mới
-- Sử dụng LAST_INSERT_ID() để lấy ID của user vừa tạo
SET @tanUserId = (SELECT id FROM users WHERE email = 'tan.nguyen@email.com');
SET @maiUserId = (SELECT id FROM users WHERE email = 'mai.le@email.com');

-- Tạo housekeepers cho users chưa xác thực (tùy chọn)
SET @tanUserId = (SELECT id FROM users WHERE email = 'tan.nguyen@email.com');
SET @maiUserId = (SELECT id FROM users WHERE email = 'mai.le@email.com');

INSERT INTO housekeepers (userId, rating, services, price, available, description, experience, backgroundChecked, insured) VALUES
(@tanUserId, 0, 'Dọn dẹp nhà cửa, Giặt ủi', 22.00, 0, 'Người giúp việc mới, cần xác thực', 2, FALSE, FALSE),
(@maiUserId, 0, 'Nấu ăn, Chăm sóc trẻ em', 28.00, 0, 'Có kinh nghiệm chăm sóc trẻ em', 3, FALSE, FALSE);

-- Tạo verification requests
INSERT INTO verification_requests (userId, requestType, userNotes, priority, submittedAt) VALUES
(@tanUserId, 'initial_verification', 'Tôi có 2 năm kinh nghiệm làm việc nhà. Mong admin xem xét sớm.', 'high', NOW()),
(@maiUserId, 'initial_verification', 'Tôi đã có chứng chỉ chăm sóc trẻ em và 3 năm kinh nghiệm.', 'normal', DATE_SUB(NOW(), INTERVAL 1 DAY));

-- Tạo sample verification documents
INSERT INTO verification_documents (userId, documentType, filePath, originalName, status) VALUES
(@tanUserId, 'id_card_front', '/uploads/id_cards/tan_id_front.jpg', 'CMND_mat_truoc.jpg', 'pending'),
(@tanUserId, 'id_card_back', '/uploads/id_cards/tan_id_back.jpg', 'CMND_mat_sau.jpg', 'pending'),
(@maiUserId, 'id_card_front', '/uploads/id_cards/mai_id_front.jpg', 'CCCD_mat_truoc.jpg', 'pending'),
(@maiUserId, 'id_card_back', '/uploads/id_cards/mai_id_back.jpg', 'CCCD_mat_sau.jpg', 'pending'),
(@maiUserId, 'certificate', '/uploads/certificates/mai_cert.pdf', 'Chung_chi_cham_soc_tre_em.pdf', 'pending');

-- Tạo notifications cho admin về verification requests
SET @adminId = (SELECT id FROM users WHERE role = 'admin' LIMIT 1);

INSERT INTO notifications (userId, type, title, message, data, createdAt) VALUES
(@adminId, 'verification_request', 'Yêu cầu xác thực mới', 
 'Nguyễn Văn Tân đã gửi yêu cầu xác thực tài khoản housekeeper', 
 CONCAT('{"userId": ', @tanUserId, ', "userName": "Nguyễn Văn Tân", "requestType": "initial_verification"}'), NOW()),
(@adminId, 'verification_request', 'Yêu cầu xác thực mới', 
 'Lê Thị Mai đã gửi yêu cầu xác thực tài khoản housekeeper', 
 CONCAT('{"userId": ', @maiUserId, ', "userName": "Lê Thị Mai", "requestType": "initial_verification"}'), NOW());

-- ========================
-- UPDATE EXISTING USERS PASSWORD HASH
-- ========================
-- Convert existing plain text passwords to SHA256 hash for security
UPDATE users SET password = SHA2(password, 256) WHERE authProvider = 'local' AND password NOT LIKE '$%';

-- ========================
-- FIX LOGIN PASSWORDS FOR ALL USERS
-- ========================
-- Cập nhật password để đăng nhập được (sử dụng SHA256)

-- Admin password: admin123
UPDATE users SET password = SHA2('admin123', 256) WHERE email = 'admin@househelp.com';

-- Housekeeper passwords: 123456
UPDATE users SET password = SHA2('123456', 256) WHERE email = 'lan.nguyen@email.com';
UPDATE users SET password = SHA2('123456', 256) WHERE email = 'minh.tran@email.com';
UPDATE users SET password = SHA2('123456', 256) WHERE email = 'tan.nguyen@email.com';
UPDATE users SET password = SHA2('123456', 256) WHERE email = 'mai.le@email.com';

-- Customer passwords: 123456  
UPDATE users SET password = SHA2('123456', 256) WHERE email = 'hoa.le@email.com';
UPDATE users SET password = SHA2('123456', 256) WHERE email = 'tuan.pham@email.com';

-- Unverified housekeeper passwords: 123456
UPDATE users SET password = SHA2('123456', 256) WHERE email = 'tan.nguyen@email.com';
UPDATE users SET password = SHA2('123456', 256) WHERE email = 'mai.le@email.com';

-- Google OAuth user (không cần password)
UPDATE users SET password = NULL WHERE email = 'googleuser@gmail.com' AND authProvider = 'google';

-- ========================
-- VERIFICATION DATA CHECK
-- ========================

-- Kiểm tra dữ liệu verification đã tạo
SELECT 'VERIFICATION SYSTEM STATUS' as info;
SELECT 'New Housekeepers Created' as status, COUNT(*) as count FROM users WHERE role = 'housekeeper' AND isVerified = 0;
SELECT 'Verification Requests' as status, COUNT(*) as count FROM verification_requests;
SELECT 'Verification Documents' as status, COUNT(*) as count FROM verification_documents;
SELECT 'Admin Notifications' as status, COUNT(*) as count FROM notifications WHERE type = 'verification_request';

-- Hiển thị thông tin housekeeper mới
SELECT 'NEW HOUSEKEEPERS INFO' as info;
SELECT fullName, email, isVerified, isApproved, createdAt FROM users WHERE email IN ('tan.nguyen@email.com', 'mai.le@email.com');

-- ========================
-- LOGIN CREDENTIALS INFO
-- ========================
SELECT '=== THÔNG TIN ĐĂNG NHẬP ===' as info;

SELECT 'ADMIN ACCOUNT' as account_type, 'admin@househelp.com' as email, 'admin123' as password, 'Quản trị hệ thống' as description;

SELECT 'HOUSEKEEPER ACCOUNTS' as account_type, '' as email, '' as password, '' as description;
SELECT '' as account_type, 'lan.nguyen@email.com' as email, '123456' as password, 'Đã xác thực - Quick Booking - $25/h' as description;
SELECT '' as account_type, 'minh.tran@email.com' as email, '123456' as password, 'Đã xác thực - Quick Booking - $30/h' as description;
SELECT '' as account_type, 'tan.nguyen@email.com' as email, '123456' as password, 'CHƯA xác thực - cần admin duyệt' as description;
SELECT '' as account_type, 'mai.le@email.com' as email, '123456' as password, 'CHƯA xác thực - cần admin duyệt' as description;

SELECT 'CUSTOMER ACCOUNTS' as account_type, '' as email, '' as password, '' as description;
SELECT '' as account_type, 'hoa.le@email.com' as email, '123456' as password, 'Khách hàng thường' as description;
SELECT '' as account_type, 'tuan.pham@email.com' as email, '123456' as password, 'Khách hàng thường' as description;

SELECT 'GOOGLE OAUTH TEST' as account_type, 'googleuser@gmail.com' as email, 'Không cần password' as password, 'Đăng nhập bằng Google' as description;

-- ========================
-- MOCK DATA FOR TESTING (20+ records)
-- ========================

-- Thêm 12 users mới (8 customers + 4 housekeepers)
INSERT INTO users (fullName, email, password, phone, role, avatar, dateOfBirth, gender, address, city, district, bio, languages, emergencyContact, emergencyContactName, isVerified, isApproved) VALUES
-- Customers mới
('Nguyễn Văn Đức', 'duc.nguyen@email.com', SHA2('123456', 256), '0901111111', 'customer', '/avatars/duc.jpg', '1995-03-12', 'male', '456 Lê Lợi, P.Bến Nghé', 'TP.HCM', 'Quận 1', 'Chủ nhà hàng cần dịch vụ vệ sinh thường xuyên', 'Tiếng Việt', '0987111111', 'Nguyễn Thị Hạnh', TRUE, TRUE),
('Trần Thị Bích', 'bich.tran@email.com', SHA2('123456', 256), '0902222222', 'customer', '/avatars/bich.jpg', '1988-07-25', 'female', '789 Nguyễn Huệ, P.Bến Nghé', 'TP.HCM', 'Quận 1', 'Mẹ đơn thân cần hỗ trợ chăm sóc trẻ', 'Tiếng Việt, Tiếng Anh', '0987222222', 'Trần Văn Hùng', TRUE, TRUE),
('Lê Minh Tuấn', 'tuan.le@email.com', SHA2('123456', 256), '0903333333', 'customer', '/avatars/tuan-le.jpg', '1992-11-08', 'male', '321 Pasteur, P.6', 'TP.HCM', 'Quận 3', 'Bác sĩ bận rộn cần dịch vụ giúp việc', 'Tiếng Việt, Tiếng Anh', '0987333333', 'Lê Thị Mai', TRUE, TRUE),
('Phạm Thị Nga', 'nga.pham@email.com', SHA2('123456', 256), '0904444444', 'customer', '/avatars/nga.jpg', '1990-05-20', 'female', '654 Võ Văn Tần, P.6', 'TP.HCM', 'Quận 3', 'Nhân viên văn phòng cần dọn dẹp cuối tuần', 'Tiếng Việt', '0987444444', 'Phạm Văn Nam', TRUE, TRUE),
('Hoàng Văn Khoa', 'khoa.hoang@email.com', SHA2('123456', 256), '0905555555', 'customer', '/avatars/khoa.jpg', '1985-12-15', 'male', '147 Hai Bà Trưng, P.Đa Kao', 'TP.HCM', 'Quận 1', 'Giám đốc công ty cần dịch vụ cao cấp', 'Tiếng Việt, Tiếng Anh, Tiếng Nhật', '0987555555', 'Hoàng Thị Lan', TRUE, TRUE),
('Vũ Thị Hương', 'huong.vu@email.com', SHA2('123456', 256), '0906666666', 'customer', '/avatars/huong-vu.jpg', '1993-09-03', 'female', '258 Cách Mạng Tháng 8, P.10', 'TP.HCM', 'Quận 3', 'Kế toán viên cần giúp việc nhà', 'Tiếng Việt', '0987666666', 'Vũ Văn Dũng', TRUE, TRUE),
('Đỗ Minh Hải', 'hai.do@email.com', SHA2('123456', 256), '0907777777', 'customer', '/avatars/hai.jpg', '1987-04-18', 'male', '369 Điện Biên Phủ, P.4', 'TP.HCM', 'Quận 3', 'Kỹ sư IT làm việc tại nhà', 'Tiếng Việt, Tiếng Anh', '0987777777', 'Đỗ Thị Linh', TRUE, TRUE),
('Bùi Thị Thanh', 'thanh.bui@email.com', SHA2('123456', 256), '0908888888', 'customer', '/avatars/thanh.jpg', '1991-01-28', 'female', '741 Lý Thái Tổ, P.9', 'TP.HCM', 'Quận 10', 'Giáo viên cần hỗ trợ dọn dẹp', 'Tiếng Việt', '0987888888', 'Bùi Văn Thành', TRUE, TRUE),

-- Housekeepers mới
('Nguyễn Thị Hương', 'huong.nguyen@email.com', SHA2('123456', 256), '0911111111', 'housekeeper', '/avatars/huong-nguyen.jpg', '1989-06-10', 'female', '852 Cộng Hòa, P.4', 'TP.HCM', 'Quận Tân Bình', 'Chuyên gia chăm sóc người già 7 năm kinh nghiệm', 'Tiếng Việt', '0981111111', 'Nguyễn Văn Tâm', TRUE, TRUE),
('Trần Văn Dũng', 'dung.tran@email.com', SHA2('123456', 256), '0912222222', 'housekeeper', '/avatars/dung-tran.jpg', '1983-02-14', 'male', '963 Hoàng Văn Thụ, P.4', 'TP.HCM', 'Quận Tân Bình', 'Thợ sửa chữa và vệ sinh chuyên nghiệp', 'Tiếng Việt', '0981222222', 'Trần Thị Hoa', TRUE, TRUE),
('Lê Thị Kim', 'kim.le@email.com', SHA2('123456', 256), '0913333333', 'housekeeper', '/avatars/kim-le.jpg', '1992-08-22', 'female', '159 Lạc Long Quân, P.3', 'TP.HCM', 'Quận 11', 'Chuyên nấu ăn và chăm sóc trẻ em', 'Tiếng Việt, Tiếng Anh', '0981333333', 'Lê Văn Hùng', TRUE, TRUE),
('Phạm Văn Long', 'long.pham@email.com', SHA2('123456', 256), '0914444444', 'housekeeper', '/avatars/long-pham.jpg', '1986-12-05', 'male', '357 Âu Cơ, P.9', 'TP.HCM', 'Quận Tân Phú', 'Chuyên vệ sinh công nghiệp và làm vườn', 'Tiếng Việt', '0981444444', 'Phạm Thị Nga', TRUE, TRUE);

-- Thêm housekeeper profiles
INSERT INTO housekeepers (userId, rating, totalReviews, services, price, priceType, description, experience, skills, certifications, workingDays, workingHours, serviceRadius, profileImages, hasInsurance, completedJobs, responseTime, isTopRated, backgroundChecked, insured) VALUES
-- Nguyễn Thị Hương (userId = 9)
((SELECT id FROM users WHERE email = 'huong.nguyen@email.com'), 4.9, 156, 'Chăm sóc người già, Dọn dẹp nhà cửa', 35.00, 'hourly', 'Chuyên gia chăm sóc người già với 7 năm kinh nghiệm. Tận tâm và chu đáo.', 7, 
JSON_ARRAY('Chăm sóc y tế cơ bản', 'Vật lý trị liệu', 'Nấu ăn dinh dưỡng', 'Tâm lý học'), 
JSON_ARRAY('Chứng chỉ chăm sóc người già', 'Chứng chỉ sơ cấp cứu', 'Chứng chỉ dinh dưỡng'), 
JSON_ARRAY('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'), 
'06:00-22:00', 25, JSON_ARRAY('/portfolio/huong-1.jpg','/portfolio/huong-2.jpg'), TRUE, 234, 10, TRUE, TRUE, TRUE),

-- Trần Văn Dũng (userId = 10)
((SELECT id FROM users WHERE email = 'dung.tran@email.com'), 4.6, 98, 'Vệ sinh công nghiệp, Sửa chữa nhỏ', 40.00, 'hourly', 'Thợ sửa chữa và vệ sinh chuyên nghiệp. Có thể xử lý mọi vấn đề trong nhà.', 10, 
JSON_ARRAY('Sửa chữa điện nước', 'Vệ sinh công nghiệp', 'Bảo trì thiết bị', 'Sơn sửa'), 
JSON_ARRAY('Chứng chỉ thợ điện', 'Chứng chỉ an toàn lao động', 'Chứng chỉ vệ sinh công nghiệp'), 
JSON_ARRAY('Monday','Tuesday','Wednesday','Thursday','Friday'), 
'07:00-18:00', 30, JSON_ARRAY('/portfolio/dung-1.jpg','/portfolio/dung-2.jpg','/portfolio/dung-3.jpg'), TRUE, 178, 25, FALSE, TRUE, TRUE),

-- Lê Thị Kim (userId = 11)
((SELECT id FROM users WHERE email = 'kim.le@email.com'), 4.8, 142, 'Nấu ăn, Chăm sóc trẻ em, Dọn dẹp', 28.00, 'hourly', 'Chuyên gia nấu ăn và chăm sóc trẻ em. Yêu thương trẻ con và nấu ăn ngon.', 6, 
JSON_ARRAY('Nấu ăn đa dạng', 'Chăm sóc trẻ sơ sinh', 'Dạy kèm trẻ em', 'Dinh dưỡng trẻ em'), 
JSON_ARRAY('Chứng chỉ nấu ăn chuyên nghiệp', 'Chứng chỉ chăm sóc trẻ em', 'Chứng chỉ dinh dưỡng'), 
JSON_ARRAY('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'), 
'06:00-20:00', 20, JSON_ARRAY('/portfolio/kim-1.jpg','/portfolio/kim-2.jpg'), TRUE, 189, 15, TRUE, TRUE, TRUE),

-- Phạm Văn Long (userId = 12)
((SELECT id FROM users WHERE email = 'long.pham@email.com'), 4.4, 76, 'Vệ sinh công nghiệp, Làm vườn', 32.00, 'hourly', 'Chuyên vệ sinh công nghiệp quy mô lớn và chăm sóc cây cối.', 8, 
JSON_ARRAY('Vệ sinh công nghiệp', 'Làm vườn chuyên nghiệp', 'Tỉa cây', 'Thiết kế cảnh quan'), 
JSON_ARRAY('Chứng chỉ vệ sinh công nghiệp', 'Chứng chỉ làm vườn', 'Chứng chỉ an toàn hóa chất'), 
JSON_ARRAY('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'), 
'05:00-17:00', 35, JSON_ARRAY('/portfolio/long-1.jpg','/portfolio/long-2.jpg','/portfolio/long-3.jpg'), TRUE, 145, 30, FALSE, TRUE, TRUE);

-- Thêm housekeeper_services cho housekeepers mới
INSERT INTO housekeeper_services (housekeeperId, serviceId) VALUES
-- Nguyễn Thị Hương: Chăm sóc người già + Dọn dẹp
(3, 5), (3, 1),
-- Trần Văn Dũng: Vệ sinh công nghiệp
(4, 6),
-- Lê Thị Kim: Nấu ăn + Chăm sóc trẻ em + Dọn dẹp
(5, 3), (5, 4), (5, 1),
-- Phạm Văn Long: Vệ sinh công nghiệp + Làm vườn
(6, 6), (6, 7);

-- Thêm 25 bookings đa dạng
INSERT INTO bookings (customerId, housekeeperId, serviceId, startDate, endDate, status, paymentStatus, totalPrice, notes, customerAddress, time, duration, location, customerName, customerEmail, customerPhone, housekeeperName, service, urgency, isQuickBooking, matchScore, createdAt) VALUES
-- Bookings với customers và housekeepers mới
((SELECT id FROM users WHERE email = 'duc.nguyen@email.com'), 3, 5, '2025-12-02 08:00:00', '2025-12-02 16:00:00', 'confirmed', 'pending', 280.00, 'Chăm sóc ông nội 85 tuổi', 'Quận 1, TP.HCM', '08:00', 8, 'Quận 1, TP.HCM', 'Nguyễn Văn Đức', 'duc.nguyen@email.com', '0901111111', 'Nguyễn Thị Hương', 'Chăm sóc người già', 'normal', FALSE, 0, DATE_SUB(NOW(), INTERVAL 2 DAY)),

((SELECT id FROM users WHERE email = 'bich.tran@email.com'), 5, 4, '2025-12-03 07:00:00', '2025-12-03 19:00:00', 'completed', 'success', 336.00, 'Chăm sóc bé 3 tuổi cả ngày', 'Quận 1, TP.HCM', '07:00', 12, 'Quận 1, TP.HCM', 'Trần Thị Bích', 'bich.tran@email.com', '0902222222', 'Lê Thị Kim', 'Chăm sóc trẻ em', 'urgent', TRUE, 92, DATE_SUB(NOW(), INTERVAL 1 DAY)),

((SELECT id FROM users WHERE email = 'tuan.le@email.com'), 4, 6, '2025-12-04 14:00:00', '2025-12-04 18:00:00', 'pending', 'pending', 160.00, 'Vệ sinh phòng khám nha khoa', 'Quận 3, TP.HCM', '14:00', 4, 'Quận 3, TP.HCM', 'Lê Minh Tuấn', 'tuan.le@email.com', '0903333333', 'Trần Văn Dũng', 'Vệ sinh công nghiệp', 'normal', FALSE, 0, NOW()),

((SELECT id FROM users WHERE email = 'nga.pham@email.com'), 1, 1, '2025-12-05 09:00:00', '2025-12-05 15:00:00', 'confirmed', 'pending', 150.00, 'Dọn dẹp tổng thể căn hộ', 'Quận 3, TP.HCM', '09:00', 6, 'Quận 3, TP.HCM', 'Phạm Thị Nga', 'nga.pham@email.com', '0904444444', 'Nguyễn Thị Lan', 'Dọn dẹp nhà cửa', 'normal', FALSE, 0, NOW()),

((SELECT id FROM users WHERE email = 'khoa.hoang@email.com'), 3, 1, '2025-12-06 10:00:00', '2025-12-06 14:00:00', 'completed', 'success', 140.00, 'Dọn dẹp villa cao cấp', 'Quận 1, TP.HCM', '10:00', 4, 'Quận 1, TP.HCM', 'Hoàng Văn Khoa', 'khoa.hoang@email.com', '0905555555', 'Nguyễn Thị Hương', 'Dọn dẹp nhà cửa', 'asap', TRUE, 98, DATE_SUB(NOW(), INTERVAL 3 DAY)),

((SELECT id FROM users WHERE email = 'huong.vu@email.com'), 5, 3, '2025-12-07 11:00:00', '2025-12-07 14:00:00', 'pending', 'pending', 84.00, 'Nấu cơm trưa cho gia đình', 'Quận 3, TP.HCM', '11:00', 3, 'Quận 3, TP.HCM', 'Vũ Thị Hương', 'huong.vu@email.com', '0906666666', 'Lê Thị Kim', 'Nấu ăn', 'normal', FALSE, 0, NOW()),

((SELECT id FROM users WHERE email = 'hai.do@email.com'), 6, 7, '2025-12-08 08:00:00', '2025-12-08 12:00:00', 'confirmed', 'pending', 128.00, 'Chăm sóc vườn sân thượng', 'Quận 3, TP.HCM', '08:00', 4, 'Quận 3, TP.HCM', 'Đỗ Minh Hải', 'hai.do@email.com', '0907777777', 'Phạm Văn Long', 'Làm vườn', 'normal', FALSE, 0, NOW()),

((SELECT id FROM users WHERE email = 'thanh.bui@email.com'), 2, 2, '2025-12-09 13:00:00', '2025-12-09 17:00:00', 'completed', 'success', 120.00, 'Giặt ủi quần áo gia đình', 'Quận 10, TP.HCM', '13:00', 4, 'Quận 10, TP.HCM', 'Bùi Thị Thanh', 'thanh.bui@email.com', '0908888888', 'Trần Văn Minh', 'Giặt ủi quần áo', 'normal', FALSE, 0, DATE_SUB(NOW(), INTERVAL 1 DAY)),

-- Thêm bookings với customers cũ và housekeepers mới
(3, 5, 3, '2025-12-10 12:00:00', '2025-12-10 15:00:00', 'pending', 'pending', 84.00, 'Nấu ăn cho bữa tiệc nhỏ', 'Quận 7, TP.HCM', '12:00', 3, 'Quận 7, TP.HCM', 'Lê Thị Hoa', 'hoa.le@email.com', '0923456789', 'Lê Thị Kim', 'Nấu ăn', 'urgent', TRUE, 89, NOW()),

(4, 6, 6, '2025-12-11 09:00:00', '2025-12-11 17:00:00', 'confirmed', 'pending', 256.00, 'Vệ sinh tòa nhà văn phòng', 'Quận Ba Đình, Hà Nội', '09:00', 8, 'Quận Ba Đình, Hà Nội', 'Phạm Văn Tuấn', 'tuan.pham@email.com', '0934567890', 'Phạm Văn Long', 'Vệ sinh công nghiệp', 'normal', FALSE, 0, NOW()),

-- Thêm các bookings đã hoàn thành để có thống kê
((SELECT id FROM users WHERE email = 'duc.nguyen@email.com'), 1, 1, '2025-11-15 10:00:00', '2025-11-15 14:00:00', 'completed', 'success', 100.00, 'Dọn dẹp nhà hàng', 'Quận 1, TP.HCM', '10:00', 4, 'Quận 1, TP.HCM', 'Nguyễn Văn Đức', 'duc.nguyen@email.com', '0901111111', 'Nguyễn Thị Lan', 'Dọn dẹp nhà cửa', 'normal', FALSE, 0, DATE_SUB(NOW(), INTERVAL 15 DAY)),

((SELECT id FROM users WHERE email = 'bich.tran@email.com'), 3, 5, '2025-11-20 08:00:00', '2025-11-20 18:00:00', 'completed', 'success', 350.00, 'Chăm sóc mẹ già', 'Quận 1, TP.HCM', '08:00', 10, 'Quận 1, TP.HCM', 'Trần Thị Bích', 'bich.tran@email.com', '0902222222', 'Nguyễn Thị Hương', 'Chăm sóc người già', 'normal', FALSE, 0, DATE_SUB(NOW(), INTERVAL 10 DAY)),

((SELECT id FROM users WHERE email = 'khoa.hoang@email.com'), 5, 4, '2025-11-25 07:00:00', '2025-11-25 19:00:00', 'completed', 'success', 336.00, 'Chăm sóc con gái 5 tuổi', 'Quận 1, TP.HCM', '07:00', 12, 'Quận 1, TP.HCM', 'Hoàng Văn Khoa', 'khoa.hoang@email.com', '0905555555', 'Lê Thị Kim', 'Chăm sóc trẻ em', 'normal', FALSE, 0, DATE_SUB(NOW(), INTERVAL 5 DAY)),

-- Thêm bookings cancelled để có đa dạng trạng thái
((SELECT id FROM users WHERE email = 'nga.pham@email.com'), 4, 6, '2025-12-12 14:00:00', '2025-12-12 18:00:00', 'cancelled', 'failed', 0.00, 'Hủy do thay đổi kế hoạch', 'Quận 3, TP.HCM', '14:00', 4, 'Quận 3, TP.HCM', 'Phạm Thị Nga', 'nga.pham@email.com', '0904444444', 'Trần Văn Dũng', 'Vệ sinh công nghiệp', 'normal', FALSE, 0, NOW()),

((SELECT id FROM users WHERE email = 'hai.do@email.com'), 2, 2, '2025-12-13 15:00:00', '2025-12-13 18:00:00', 'cancelled', 'failed', 0.00, 'Hủy do bận đột xuất', 'Quận 3, TP.HCM', '15:00', 3, 'Quận 3, TP.HCM', 'Đỗ Minh Hải', 'hai.do@email.com', '0907777777', 'Trần Văn Minh', 'Giặt ủi quần áo', 'normal', FALSE, 0, NOW());

-- Thêm 30 reviews đa dạng
INSERT INTO reviews (bookingId, housekeeperId, customerId, rating, comment, createdAt) VALUES
-- Reviews cho housekeepers mới
((SELECT MAX(id)-14 FROM bookings), 3, (SELECT id FROM users WHERE email = 'duc.nguyen@email.com'), 5, 'Chị Hương chăm sóc ông nội rất tận tâm và chu đáo. Gia đình rất hài lòng!', DATE_SUB(NOW(), INTERVAL 2 DAY)),
((SELECT MAX(id)-13 FROM bookings), 5, (SELECT id FROM users WHERE email = 'bich.tran@email.com'), 5, 'Chị Kim rất giỏi với trẻ em, con tôi rất thích chị ấy. Sẽ book lại!', DATE_SUB(NOW(), INTERVAL 1 DAY)),
((SELECT MAX(id)-9 FROM bookings), 3, (SELECT id FROM users WHERE email = 'khoa.hoang@email.com'), 5, 'Dịch vụ cao cấp, chuyên nghiệp. Nhà cửa sạch sẽ như mới!', DATE_SUB(NOW(), INTERVAL 3 DAY)),
((SELECT MAX(id)-7 FROM bookings), 2, (SELECT id FROM users WHERE email = 'thanh.bui@email.com'), 4, 'Anh Minh làm việc nhanh gọn, quần áo được ủi rất đẹp.', DATE_SUB(NOW(), INTERVAL 1 DAY)),
((SELECT MAX(id)-5 FROM bookings), 1, (SELECT id FROM users WHERE email = 'duc.nguyen@email.com'), 5, 'Chị Lan làm việc rất cẩn thận, nhà hàng sạch sẽ hoàn hảo.', DATE_SUB(NOW(), INTERVAL 15 DAY)),
((SELECT MAX(id)-4 FROM bookings), 3, (SELECT id FROM users WHERE email = 'bich.tran@email.com'), 5, 'Chăm sóc mẹ tôi như người thân trong gia đình. Cảm ơn chị Hương!', DATE_SUB(NOW(), INTERVAL 10 DAY)),
((SELECT MAX(id)-3 FROM bookings), 5, (SELECT id FROM users WHERE email = 'khoa.hoang@email.com'), 5, 'Chị Kim nấu ăn ngon và chăm con rất tốt. Highly recommended!', DATE_SUB(NOW(), INTERVAL 5 DAY)),

-- Reviews bổ sung cho housekeepers cũ
(1, 1, 3, 5, 'Lần thứ 3 sử dụng dịch vụ của chị Lan, luôn hài lòng 100%!', DATE_SUB(NOW(), INTERVAL 20 DAY)),
(2, 2, 4, 4, 'Anh Minh làm việc chuyên nghiệp, sẽ giới thiệu cho bạn bè.', DATE_SUB(NOW(), INTERVAL 18 DAY)),

-- Thêm reviews từ customers mới cho housekeepers cũ
((SELECT MAX(id) FROM bookings WHERE customerId = (SELECT id FROM users WHERE email = 'nga.pham@email.com') AND status = 'confirmed'), 1, (SELECT id FROM users WHERE email = 'nga.pham@email.com'), 5, 'Chị Lan dọn dẹp rất sạch sẽ, căn hộ như mới. Cảm ơn chị!', NOW()),

-- Reviews cho các dịch vụ khác nhau
((SELECT id FROM bookings WHERE housekeeperId = 5 AND serviceId = 3 LIMIT 1), 5, (SELECT id FROM users WHERE email = 'huong.vu@email.com'), 5, 'Chị Kim nấu ăn rất ngon, món nào cũng hợp khẩu vị gia đình.', NOW()),
((SELECT id FROM bookings WHERE housekeeperId = 6 AND serviceId = 7 LIMIT 1), 6, (SELECT id FROM users WHERE email = 'hai.do@email.com'), 4, 'Anh Long chăm sóc vườn rất tỉ mỉ, cây cối xanh tốt hơn hẳn.', NOW());

-- Thêm 20 payment records
INSERT INTO payments (bookingId, customerId, method, amount, status, transactionCode, paidAt, createdAt) VALUES
-- Payments cho bookings đã hoàn thành
((SELECT MAX(id)-13 FROM bookings), (SELECT id FROM users WHERE email = 'bich.tran@email.com'), 'e_wallet', 336.00, 'success', CONCAT('PAY_', UNIX_TIMESTAMP(), '_1'), DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY)),
((SELECT MAX(id)-9 FROM bookings), (SELECT id FROM users WHERE email = 'khoa.hoang@email.com'), 'credit_card', 140.00, 'success', CONCAT('PAY_', UNIX_TIMESTAMP(), '_2'), DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 3 DAY)),
((SELECT MAX(id)-7 FROM bookings), (SELECT id FROM users WHERE email = 'thanh.bui@email.com'), 'cash', 120.00, 'success', CONCAT('PAY_', UNIX_TIMESTAMP(), '_3'), DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY)),
((SELECT MAX(id)-5 FROM bookings), (SELECT id FROM users WHERE email = 'duc.nguyen@email.com'), 'bank_transfer', 100.00, 'success', CONCAT('PAY_', UNIX_TIMESTAMP(), '_4'), DATE_SUB(NOW(), INTERVAL 15 DAY), DATE_SUB(NOW(), INTERVAL 15 DAY)),
((SELECT MAX(id)-4 FROM bookings), (SELECT id FROM users WHERE email = 'bich.tran@email.com'), 'e_wallet', 350.00, 'success', CONCAT('PAY_', UNIX_TIMESTAMP(), '_5'), DATE_SUB(NOW(), INTERVAL 10 DAY), DATE_SUB(NOW(), INTERVAL 10 DAY)),
((SELECT MAX(id)-3 FROM bookings), (SELECT id FROM users WHERE email = 'khoa.hoang@email.com'), 'credit_card', 336.00, 'success', CONCAT('PAY_', UNIX_TIMESTAMP(), '_6'), DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY)),

-- Payments pending cho bookings confirmed
((SELECT MAX(id)-14 FROM bookings), (SELECT id FROM users WHERE email = 'duc.nguyen@email.com'), 'cash', 280.00, 'pending', NULL, NULL, NOW()),
((SELECT MAX(id)-11 FROM bookings), (SELECT id FROM users WHERE email = 'nga.pham@email.com'), 'e_wallet', 150.00, 'pending', NULL, NULL, NOW()),
((SELECT MAX(id)-8 FROM bookings), (SELECT id FROM users WHERE email = 'hai.do@email.com'), 'bank_transfer', 128.00, 'pending', NULL, NULL, NOW()),
((SELECT MAX(id)-6 FROM bookings), (SELECT id FROM users WHERE email = 'huong.vu@email.com'), 'credit_card', 84.00, 'pending', NULL, NULL, NOW());

-- Thêm 15 notifications đa dạng
INSERT INTO notifications (userId, type, urgency, title, message, bookingId, data, createdAt, read_status) VALUES
-- Notifications cho customers mới
((SELECT id FROM users WHERE email = 'duc.nguyen@email.com'), 'booking_confirmed', 'normal', 'Đặt lịch thành công', 'Nguyễn Thị Hương đã xác nhận lịch chăm sóc người già', (SELECT MAX(id)-14 FROM bookings), '{"serviceType": "eldercare"}', DATE_SUB(NOW(), INTERVAL 2 DAY), 1),

((SELECT id FROM users WHERE email = 'bich.tran@email.com'), 'booking_completed', 'normal', 'Hoàn thành dịch vụ', 'Lê Thị Kim đã hoàn thành chăm sóc trẻ em. Vui lòng đánh giá!', (SELECT MAX(id)-13 FROM bookings), '{"paymentRequired": true}', DATE_SUB(NOW(), INTERVAL 1 DAY), 0),

((SELECT id FROM users WHERE email = 'khoa.hoang@email.com'), 'payment_received', 'normal', 'Thanh toán thành công', 'Đã nhận thanh toán $140.00 cho dịch vụ dọn dẹp villa', (SELECT MAX(id)-9 FROM bookings), '{"amount": 140.00, "method": "credit_card"}', DATE_SUB(NOW(), INTERVAL 3 DAY), 1),

-- Notifications cho housekeepers mới
((SELECT id FROM users WHERE email = 'huong.nguyen@email.com'), 'new_booking', 'urgent', 'Đơn đặt lịch mới', 'Nguyễn Văn Đức cần dịch vụ chăm sóc người già', (SELECT MAX(id)-14 FROM bookings), '{"customerPhone": "0901111111"}', DATE_SUB(NOW(), INTERVAL 2 DAY), 1),

((SELECT id FROM users WHERE email = 'kim.le@email.com'), 'quick_booking', 'urgent', '⚡ Đơn đặt lịch GẤP!', 'Trần Thị Bích cần chăm sóc trẻ em khẩn cấp', (SELECT MAX(id)-13 FROM bookings), '{"urgency": "urgent", "isQuickBooking": true}', DATE_SUB(NOW(), INTERVAL 1 DAY), 0),

((SELECT id FROM users WHERE email = 'long.pham@email.com'), 'booking_confirmed', 'normal', 'Lịch hẹn đã xác nhận', 'Phạm Văn Tuấn đã xác nhận lịch vệ sinh công nghiệp', (SELECT MAX(id)-6 FROM bookings), '{"serviceDate": "2025-12-11"}', NOW(), 0),

-- Notifications hệ thống
((SELECT id FROM users WHERE role = 'admin' LIMIT 1), 'system_alert', 'high', 'Doanh thu tăng trưởng', 'Doanh thu tháng này tăng 25% so với tháng trước', NULL, '{"revenue_growth": 25, "period": "monthly"}', NOW(), 0),

((SELECT id FROM users WHERE role = 'admin' LIMIT 1), 'new_user', 'normal', 'Người dùng mới', '4 housekeepers mới đã đăng ký hôm nay', NULL, '{"new_housekeepers": 4, "date": "2025-12-01"}', NOW(), 0),

-- Notifications đánh giá
((SELECT id FROM users WHERE email = 'lan.nguyen@email.com'), 'new_review', 'normal', 'Đánh giá mới', 'Nguyễn Văn Đức đã đánh giá 5 sao cho dịch vụ của bạn', (SELECT MAX(id)-5 FROM bookings), '{"rating": 5, "hasComment": true}', DATE_SUB(NOW(), INTERVAL 15 DAY), 1),

((SELECT id FROM users WHERE email = 'minh.tran@email.com'), 'new_review', 'normal', 'Đánh giá mới', 'Bùi Thị Thanh đã đánh giá 4 sao cho dịch vụ giặt ủi', (SELECT MAX(id)-7 FROM bookings), '{"rating": 4, "hasComment": true}', DATE_SUB(NOW(), INTERVAL 1 DAY), 0);

-- Thêm chat messages đa dạng
INSERT INTO chat_messages (bookingId, senderId, receiverId, message, messageType, createdAt) VALUES
-- Chat cho booking chăm sóc người già
((SELECT MAX(id)-14 FROM bookings), (SELECT id FROM users WHERE email = 'duc.nguyen@email.com'), (SELECT id FROM users WHERE email = 'huong.nguyen@email.com'), 'Chào chị Hương, ông nội tôi 85 tuổi, cần chăm sóc đặc biệt', 'text', DATE_SUB(NOW(), INTERVAL 2 DAY)),
((SELECT MAX(id)-14 FROM bookings), (SELECT id FROM users WHERE email = 'huong.nguyen@email.com'), (SELECT id FROM users WHERE email = 'duc.nguyen@email.com'), 'Dạ em hiểu, em sẽ chăm sóc ông rất tận tâm. Ông có bệnh gì đặc biệt không ạ?', 'text', DATE_SUB(NOW(), INTERVAL 2 DAY)),
((SELECT MAX(id)-14 FROM bookings), (SELECT id FROM users WHERE email = 'duc.nguyen@email.com'), (SELECT id FROM users WHERE email = 'huong.nguyen@email.com'), 'Ông có tiểu đường và cao huyết áp, cần uống thuốc đúng giờ', 'text', DATE_SUB(NOW(), INTERVAL 2 DAY)),

-- Chat cho booking chăm sóc trẻ em
((SELECT MAX(id)-13 FROM bookings), (SELECT id FROM users WHERE email = 'bich.tran@email.com'), (SELECT id FROM users WHERE email = 'kim.le@email.com'), 'Chị Kim ơi, con tôi 3 tuổi rất nghịch, chị cần lưu ý gì không?', 'text', DATE_SUB(NOW(), INTERVAL 1 DAY)),
((SELECT MAX(id)-13 FROM bookings), (SELECT id FROM users WHERE email = 'kim.le@email.com'), (SELECT id FROM users WHERE email = 'bich.tran@email.com'), 'Dạ không sao, em rất thích trẻ con. Bé có dị ứng thức ăn gì không ạ?', 'text', DATE_SUB(NOW(), INTERVAL 1 DAY)),

-- Chat cho booking nấu ăn
((SELECT MAX(id)-6 FROM bookings), (SELECT id FROM users WHERE email = 'huong.vu@email.com'), (SELECT id FROM users WHERE email = 'kim.le@email.com'), 'Chị có thể nấu món gì cho bữa trưa gia đình 4 người?', 'text', NOW()),
((SELECT MAX(id)-6 FROM bookings), (SELECT id FROM users WHERE email = 'kim.le@email.com'), (SELECT id FROM users WHERE email = 'huong.vu@email.com'), 'Em có thể nấu cơm tấm, canh chua, thịt kho. Gia đình có ai kiêng gì không ạ?', 'text', NOW()),

-- Chat cho booking làm vườn
((SELECT MAX(id)-8 FROM bookings), (SELECT id FROM users WHERE email = 'hai.do@email.com'), (SELECT id FROM users WHERE email = 'long.pham@email.com'), 'Anh Long, vườn sân thượng tôi có khoảng 20m2, cần tỉa cành và bón phân', 'text', NOW()),
((SELECT MAX(id)-8 FROM bookings), (SELECT id FROM users WHERE email = 'long.pham@email.com'), (SELECT id FROM users WHERE email = 'hai.do@email.com'), 'Dạ được, anh sẽ mang theo dụng cụ và phân bón. Vườn chủ yếu trồng cây gì ạ?', 'text', NOW());

-- Cập nhật completedJobs cho tất cả housekeepers
UPDATE housekeepers SET 
  completedJobs = completedJobs + (SELECT COUNT(*) FROM bookings WHERE housekeeperId = housekeepers.id AND status = 'completed'),
  updatedAt = NOW();

-- Cập nhật rating và totalReviews cho tất cả housekeepers
UPDATE housekeepers h SET 
  rating = COALESCE((SELECT AVG(r.rating) FROM reviews r WHERE r.housekeeperId = h.id), 0),
  totalReviews = COALESCE((SELECT COUNT(*) FROM reviews r WHERE r.housekeeperId = h.id), 0),
  updatedAt = NOW();

-- Thêm reviews để có housekeepers đạt tiêu chuẩn Top Rated (rating >= 4.5, reviews >= 5)
INSERT INTO reviews (bookingId, housekeeperId, customerId, rating, comment, createdAt) VALUES
-- Thêm reviews cho Nguyễn Thị Lan (housekeeperId = 1) để đạt Top Rated
(1, 1, 3, 5, 'Xuất sắc! Chị Lan làm việc rất chuyên nghiệp và tận tâm.', DATE_SUB(NOW(), INTERVAL 30 DAY)),
(1, 1, 4, 5, 'Dịch vụ tuyệt vời, nhà cửa sạch sẽ hoàn hảo!', DATE_SUB(NOW(), INTERVAL 25 DAY)),
(1, 1, (SELECT id FROM users WHERE email = 'duc.nguyen@email.com'), 5, 'Rất hài lòng với chất lượng dịch vụ của chị Lan!', DATE_SUB(NOW(), INTERVAL 20 DAY)),
(1, 1, (SELECT id FROM users WHERE email = 'khoa.hoang@email.com'), 5, 'Top quality service! Highly recommended!', DATE_SUB(NOW(), INTERVAL 15 DAY)),
(1, 1, (SELECT id FROM users WHERE email = 'bich.tran@email.com'), 5, 'Chị Lan làm việc rất cẩn thận và chu đáo.', DATE_SUB(NOW(), INTERVAL 10 DAY)),

-- Thêm reviews cho Nguyễn Thị Hương (housekeeperId = 3) để đạt Top Rated  
(2, 3, 4, 5, 'Chuyên gia chăm sóc người già thực thụ! Rất tận tâm.', DATE_SUB(NOW(), INTERVAL 28 DAY)),
(2, 3, (SELECT id FROM users WHERE email = 'duc.nguyen@email.com'), 5, 'Chị Hương chăm sóc ông nội rất chu đáo.', DATE_SUB(NOW(), INTERVAL 22 DAY)),
(2, 3, (SELECT id FROM users WHERE email = 'tuan.le@email.com'), 5, 'Dịch vụ chăm sóc người già tuyệt vời!', DATE_SUB(NOW(), INTERVAL 18 DAY)),
(2, 3, (SELECT id FROM users WHERE email = 'nga.pham@email.com'), 5, 'Rất hài lòng với sự chăm sóc của chị Hương.', DATE_SUB(NOW(), INTERVAL 12 DAY)),
(2, 3, (SELECT id FROM users WHERE email = 'huong.vu@email.com'), 5, 'Chuyên nghiệp và tận tâm. Highly recommended!', DATE_SUB(NOW(), INTERVAL 8 DAY)),

-- Thêm reviews cho Lê Thị Kim (housekeeperId = 5) để đạt Top Rated
(3, 5, 3, 5, 'Chị Kim nấu ăn ngon và chăm trẻ rất tốt!', DATE_SUB(NOW(), INTERVAL 26 DAY)),
(3, 5, (SELECT id FROM users WHERE email = 'duc.nguyen@email.com'), 5, 'Con tôi rất thích chị Kim. Sẽ book lại!', DATE_SUB(NOW(), INTERVAL 21 DAY)),
(3, 5, (SELECT id FROM users WHERE email = 'khoa.hoang@email.com'), 5, 'Excellent childcare service!', DATE_SUB(NOW(), INTERVAL 16 DAY)),
(3, 5, (SELECT id FROM users WHERE email = 'hai.do@email.com'), 5, 'Chị Kim rất giỏi với trẻ em và nấu ăn ngon.', DATE_SUB(NOW(), INTERVAL 11 DAY)),
(3, 5, (SELECT id FROM users WHERE email = 'thanh.bui@email.com'), 5, 'Dịch vụ chăm sóc trẻ em xuất sắc!', DATE_SUB(NOW(), INTERVAL 6 DAY));

-- Cập nhật lại rating sau khi thêm reviews mới
UPDATE housekeepers h SET 
  rating = COALESCE((SELECT AVG(r.rating) FROM reviews r WHERE r.housekeeperId = h.id), 0),
  totalReviews = COALESCE((SELECT COUNT(*) FROM reviews r WHERE r.housekeeperId = h.id), 0),
  isTopRated = CASE 
    WHEN COALESCE((SELECT AVG(r.rating) FROM reviews r WHERE r.housekeeperId = h.id), 0) >= 4.5 
         AND COALESCE((SELECT COUNT(*) FROM reviews r WHERE r.housekeeperId = h.id), 0) >= 5 
    THEN TRUE 
    ELSE FALSE 
  END,
  updatedAt = NOW();

-- Cập nhật paymentStatus cho bookings có payment thành công
UPDATE bookings b 
SET paymentStatus = 'success' 
WHERE EXISTS (
    SELECT 1 FROM payments p 
    WHERE p.bookingId = b.id AND p.status = 'success'
);

-- Thêm system logs cho hoạt động mới
INSERT INTO system_logs (userId, action, description, ipAddress, createdAt) VALUES
((SELECT id FROM users WHERE email = 'duc.nguyen@email.com'), 'BOOKING_CREATED', 'Customer tạo booking chăm sóc người già', '192.168.1.40', DATE_SUB(NOW(), INTERVAL 2 DAY)),
((SELECT id FROM users WHERE email = 'bich.tran@email.com'), 'QUICK_BOOKING_CREATED', 'Customer tạo quick booking chăm sóc trẻ em khẩn cấp', '192.168.1.41', DATE_SUB(NOW(), INTERVAL 1 DAY)),
((SELECT id FROM users WHERE email = 'khoa.hoang@email.com'), 'PAYMENT_CONFIRMED', 'Customer thanh toán dịch vụ dọn dẹp villa', '192.168.1.42', DATE_SUB(NOW(), INTERVAL 3 DAY)),
((SELECT id FROM users WHERE email = 'huong.nguyen@email.com'), 'BOOKING_CONFIRMED', 'Housekeeper xác nhận booking chăm sóc người già', '192.168.1.43', DATE_SUB(NOW(), INTERVAL 2 DAY)),
((SELECT id FROM users WHERE email = 'kim.le@email.com'), 'BOOKING_COMPLETED', 'Housekeeper hoàn thành chăm sóc trẻ em', '192.168.1.44', DATE_SUB(NOW(), INTERVAL 1 DAY)),
((SELECT id FROM users WHERE role = 'admin' LIMIT 1), 'ADMIN_VIEW_ANALYTICS', 'Admin xem báo cáo thống kê tổng quan', '192.168.1.10', NOW());

-- ========================
-- COUPONS TABLE
-- ========================
CREATE TABLE coupons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  description VARCHAR(255) NOT NULL,
  discount DECIMAL(10,2) NOT NULL,
  type ENUM('percentage', 'fixed') NOT NULL,
  minAmount DECIMAL(10,2) DEFAULT 0,
  maxDiscount DECIMAL(10,2) DEFAULT 0,
  firstTimeOnly BOOLEAN DEFAULT FALSE,
  isActive BOOLEAN DEFAULT TRUE,
  usageLimit INT DEFAULT NULL,
  usedCount INT DEFAULT 0,
  expiresAt DATETIME DEFAULT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Thêm mã giảm giá mẫu
INSERT INTO coupons (code, description, discount, type, minAmount, maxDiscount, firstTimeOnly, isActive) VALUES
('FIRST20', 'Giảm 20% cho đơn hàng đầu tiên', 20, 'percentage', 50, 100, TRUE, TRUE),
('SAVE10', 'Giảm $10 cho đơn hàng từ $30', 10, 'fixed', 30, 10, FALSE, TRUE),
('EMERGENCY15', 'Giảm 15% cho dịch vụ khẩn cấp', 15, 'percentage', 40, 50, FALSE, TRUE),
('WELCOME5', 'Giảm $5 cho khách hàng mới', 5, 'fixed', 25, 5, TRUE, TRUE),
('LOYALTY25', 'Giảm 25% cho khách hàng thân thiết', 25, 'percentage', 100, 150, FALSE, TRUE);

-- Bảng theo dõi sử dụng coupon
CREATE TABLE coupon_usage (
  id INT AUTO_INCREMENT PRIMARY KEY,
  couponId INT NOT NULL,
  userId INT NOT NULL,
  bookingId INT NULL,
  discountAmount DECIMAL(10,2) NOT NULL,
  usedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (couponId) REFERENCES coupons(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (bookingId) REFERENCES bookings(id) ON DELETE SET NULL,
  INDEX idx_coupon_user (couponId, userId),
  INDEX idx_user_coupon (userId, couponId)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =====================================================
-- SAMPLE COUPON DATA - Dữ liệu mã giảm giá mẫu
-- =====================================================

INSERT INTO coupons (code, description, discount, type, minAmount, maxDiscount, firstTimeOnly, isActive, usageLimit, expiresAt) VALUES
('WELCOME20', 'Giảm 20% cho khách hàng mới', 20, 'percentage', 50, 100, TRUE, TRUE, 100, '2025-12-31'),
('SUMMER2024', 'Ưu đãi mùa hè - Giảm 15%', 15, 'percentage', 30, 50, FALSE, TRUE, 200, '2024-08-31'),
('FLASH50', 'Flash Sale - Giảm $50', 50, 'fixed', 200, 0, FALSE, TRUE, 50, '2024-12-15'),
('NEWYEAR25', 'Chào năm mới - Giảm 25%', 25, 'percentage', 100, 150, FALSE, TRUE, 300, '2025-01-31'),
('FIRSTTIME', 'Lần đầu sử dụng - Giảm $30', 30, 'fixed', 80, 0, TRUE, TRUE, NULL, NULL),
('LOYALTY10', 'Khách hàng thân thiết - Giảm 10%', 10, 'percentage', 0, 25, FALSE, TRUE, NULL, NULL),
('WEEKEND15', 'Cuối tuần vui vẻ - Giảm 15%', 15, 'percentage', 40, 60, FALSE, TRUE, 100, '2024-12-31'),
('EMERGENCY', 'Dịch vụ khẩn cấp - Giảm $20', 20, 'fixed', 100, 0, FALSE, TRUE, 150, '2025-06-30');

-- =====================================================
-- SAMPLE COUPON USAGE DATA - Dữ liệu sử dụng mã giảm giá mẫu
-- =====================================================

INSERT INTO coupon_usage (couponId, userId, bookingId, discountAmount, usedAt) VALUES
(1, 1, 1, 15.00, '2024-11-15 10:30:00'),  -- WELCOME20 used by customer 1
(2, 2, 3, 10.50, '2024-11-20 14:15:00'),  -- SUMMER2024 used by customer 2
(3, 4, 5, 50.00, '2024-11-25 09:45:00'),  -- FLASH50 used by customer 4
(1, 5, 7, 20.00, '2024-11-28 16:20:00'),  -- WELCOME20 used by customer 5
((SELECT id FROM coupons WHERE code = 'LOYALTY10' LIMIT 1), 1, 9, 8.50, '2024-11-29 11:10:00');

-- =====================================================
-- SAMPLE HOUSEKEEPER PRICE NORMALIZATION
-- Gia mau chuan hoa theo VND/gio: 60,000 - 100,000
-- Dat o cuoi file de de bao tri va ghi de cac INSERT phia tren.
-- =====================================================

UPDATE housekeepers h
JOIN users u ON h.userId = u.id
SET
  h.price = CASE u.email
    WHEN 'tan.nguyen@email.com' THEN 60000.00
    WHEN 'mai.le@email.com' THEN 65000.00
    WHEN 'lan.nguyen@email.com' THEN 75000.00
    WHEN 'kim.le@email.com' THEN 80000.00
    WHEN 'long.pham@email.com' THEN 85000.00
    WHEN 'minh.tran@email.com' THEN 90000.00
    WHEN 'dung.tran@email.com' THEN 95000.00
    WHEN 'huong.nguyen@email.com' THEN 100000.00
    ELSE h.price
  END,
  h.priceType = 'hourly'
WHERE u.email IN (
  'tan.nguyen@email.com',
  'mai.le@email.com',
  'lan.nguyen@email.com',
  'kim.le@email.com',
  'long.pham@email.com',
  'minh.tran@email.com',
  'dung.tran@email.com',
  'huong.nguyen@email.com'
);

COMMIT;
