import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { authHeaders } from '../api/userApi';

const InitialVerificationForm = ({ onClose, onSuccess }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    userNotes: '',
    documents: []
  });
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    setUploading(true);
    const uploadPromises = files.map(async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', user.id);
      formData.append('fileType', getFileUploadStorageType(file.name));

      try {
        const response = await fetch('http://localhost:5000/api/upload', {
          method: 'POST',
          headers: authHeaders(),
          body: formData
        });

        if (response.ok) {
          const result = await response.json();
          console.log('Upload result:', result);
          return {
            type: getVerificationDocumentType(file.name),
            path: result.file?.path || result.filePath || result.path,
            originalName: file.name
          };
        } else {
          const errorText = await response.text();
          console.error('Upload failed:', errorText);
          throw new Error(`Upload failed: ${errorText}`);
        }
      } catch (error) {
        console.error('Error uploading file:', error);
        alert(`Lỗi upload file ${file.name}: ${error.message}`);
        return null;
      }
    });

    try {
      const results = await Promise.all(uploadPromises);
      const successfulUploads = results.filter(result => result !== null);
      
      setUploadedFiles(prev => [...prev, ...successfulUploads]);
      setFormData(prev => ({
        ...prev,
        documents: [...prev.documents, ...successfulUploads]
      }));
      
      console.log('Files uploaded successfully:', successfulUploads);
    } catch (error) {
      console.error('Error in file upload process:', error);
    } finally {
      setUploading(false);
    }
  };

  /** Loại hiển thị / lưu verification_documents (ENUM riêng) */
  const getVerificationDocumentType = (filename) => {
    const name = filename.toLowerCase();
    if (name.includes('id') || name.includes('cmnd') || name.includes('cccd')) {
      return name.includes('back') || name.includes('sau') ? 'id_card_back' : 'id_card_front';
    }
    if (name.includes('cert') || name.includes('chung')) {
      return 'certificate';
    }
    return 'other';
  };

  /** Loại lưu bảng file_uploads (chỉ avatar | id_card_* | profile_image | document) */
  const getFileUploadStorageType = (filename) => {
    const v = getVerificationDocumentType(filename);
    if (v === 'id_card_front' || v === 'id_card_back') return v;
    return 'document';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.userNotes.trim()) {
      alert('Vui lòng nhập ghi chú về bản thân và kinh nghiệm');
      return;
    }

    // Validate documents
    const validDocuments = formData.documents.filter(doc => 
      doc.path && doc.type && doc.originalName
    );

    if (validDocuments.length === 0) {
      alert('Vui lòng tải lên ít nhất một tài liệu xác minh (CMND/CCCD, chứng chỉ...)');
      return;
    }

    try {
      setUploading(true);
      
      const submitData = {
        userId: user.id,
        userNotes: formData.userNotes,
        documents: validDocuments
      };
      
      console.log('Submitting initial verification data:', submitData);
      
      const response = await fetch('http://localhost:5000/api/verification/submit', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(submitData)
      });

      const result = await response.json();

      if (response.ok) {
        alert('Đã gửi yêu cầu xét duyệt thành công! Admin sẽ xem xét trong vòng 24-48 giờ.');
        onSuccess && onSuccess();
        onClose && onClose();
      } else {
        alert(result.message || 'Có lỗi xảy ra khi gửi yêu cầu');
      }
    } catch (error) {
      console.error('Error submitting verification:', error);
      alert('Có lỗi xảy ra: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    setFormData(prev => ({
      ...prev,
      documents: prev.documents.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="verification-form-overlay">
      <div className="verification-form-container">
        <div className="verification-form-header">
          <h3>📤 Gửi yêu cầu xét duyệt tài khoản</h3>
          <button 
            className="close-btn"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6b7280'
            }}
          >
            ×
          </button>
        </div>

        <div className="form-intro">
          <p>Để trở thành người giúp việc được xác minh, bạn cần cung cấp:</p>
          <ul>
            <li>✅ Thông tin về bản thân và kinh nghiệm</li>
            <li>✅ CMND/CCCD (mặt trước và mặt sau)</li>
            <li>✅ Chứng chỉ liên quan (nếu có)</li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="verification-form">
          <div className="form-group">
            <label htmlFor="userNotes">
              <strong>Giới thiệu về bản thân: *</strong>
            </label>
            <textarea
              id="userNotes"
              value={formData.userNotes}
              onChange={(e) => setFormData(prev => ({ ...prev, userNotes: e.target.value }))}
              placeholder="Hãy giới thiệu về bản thân, kinh nghiệm làm việc, kỹ năng đặc biệt... Ví dụ: 'Tôi có 3 năm kinh nghiệm làm việc nhà, có chứng chỉ chăm sóc trẻ em...'"
              rows="5"
              required
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                resize: 'vertical'
              }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="documents">
              <strong>Tài liệu xác minh: *</strong>
            </label>
            <input
              type="file"
              id="documents"
              multiple
              accept="image/*,.pdf"
              onChange={handleFileUpload}
              disabled={uploading}
              style={{
                width: '100%',
                padding: '12px',
                border: '2px dashed #d1d5db',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            />
            <div className="file-help">
              Chấp nhận: JPG, PNG, PDF. Vui lòng tải lên CMND/CCCD và chứng chỉ (nếu có).
            </div>
          </div>

          {uploadedFiles.length > 0 && (
            <div className="uploaded-files">
              <h4>📎 Files đã tải lên:</h4>
              <div className="files-list">
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="file-item">
                    <span className="file-name">{file.originalName}</span>
                    <span className="file-type">({file.type})</span>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="remove-file-btn"
                      style={{
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '4px 8px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        marginLeft: '8px'
                      }}
                    >
                      Xóa
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="form-actions">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              style={{
                padding: '12px 24px',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                marginRight: '12px'
              }}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={uploading || !formData.userNotes.trim() || uploadedFiles.length === 0}
              style={{
                padding: '12px 24px',
                backgroundColor: uploading || !formData.userNotes.trim() || uploadedFiles.length === 0 ? '#9ca3af' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: uploading || !formData.userNotes.trim() || uploadedFiles.length === 0 ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontWeight: '600'
              }}
            >
              {uploading ? 'Đang gửi...' : '📤 Gửi yêu cầu xét duyệt'}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .verification-form-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .verification-form-container {
          background: white;
          border-radius: 12px;
          padding: 24px;
          max-width: 600px;
          width: 90%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }

        .verification-form-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 12px;
          border-bottom: 1px solid #e5e7eb;
        }

        .verification-form-header h3 {
          margin: 0;
          color: #1f2937;
          font-size: 20px;
        }

        .form-intro {
          background: #f0f9ff;
          border: 1px solid #0ea5e9;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
        }

        .form-intro p {
          margin: 0 0 12px 0;
          color: #0c4a6e;
          font-weight: 600;
        }

        .form-intro ul {
          margin: 0;
          padding-left: 20px;
          color: #0c4a6e;
        }

        .form-intro li {
          margin-bottom: 4px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          margin-bottom: 8px;
          color: #374151;
          font-size: 14px;
        }

        .file-help {
          font-size: 12px;
          color: #6b7280;
          margin-top: 4px;
        }

        .uploaded-files {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
        }

        .uploaded-files h4 {
          margin: 0 0 12px 0;
          color: #374151;
          font-size: 14px;
        }

        .files-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .file-item {
          display: flex;
          align-items: center;
          padding: 8px 12px;
          background: white;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
        }

        .file-name {
          flex: 1;
          color: #374151;
        }

        .file-type {
          color: #6b7280;
          font-size: 12px;
          margin-left: 8px;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
        }
      `}</style>
    </div>
  );
};

export default InitialVerificationForm;
