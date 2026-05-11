import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { authHeaders } from '../api/userApi';
import UploadBox from '../views/Common/UploadBox';

const VerificationStatus = () => {
  const { user } = useAuth();
  const [verificationData, setVerificationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [submitForm, setSubmitForm] = useState({
    userNotes: '',
    documents: []
  });

  useEffect(() => {
    if (user?.id && user?.role === 'housekeeper') {
      fetchVerificationStatus();
    }
  }, [user]);

  const fetchVerificationStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:5000/api/verification/status/${user.id}`, {
        headers: authHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        setVerificationData(data);
      } else {
        console.error('Error fetching verification status');
      }
    } catch (error) {
      console.error('Error fetching verification status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentUpload = async (file, documentType) => {
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileType', documentType);
      formData.append('userId', user.id);

      const response = await fetch('http://localhost:5000/api/upload', {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSubmitForm(prev => ({
          ...prev,
          documents: [
            ...prev.documents.filter(doc => doc.type !== documentType),
            {
              type: documentType,
              path: data.file.path,
              originalName: data.file.originalName
            }
          ]
        }));
      } else {
        alert(data.message || 'Lỗi upload file');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Có lỗi xảy ra khi upload file');
    }
  };

  const handleSubmitVerification = async () => {
    if (submitForm.documents.length === 0) {
      alert('Vui lòng upload ít nhất một tài liệu xác thực');
      return;
    }

    try {
      setSubmitting(true);
      
      const response = await fetch('http://localhost:5000/api/verification/submit', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          userId: user.id,
          userNotes: submitForm.userNotes,
          documents: submitForm.documents
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        alert(data.message);
        setShowSubmitForm(false);
        setSubmitForm({ userNotes: '', documents: [] });
        fetchVerificationStatus(); // Refresh status
      } else {
        alert(data.message || data.error || 'Lỗi gửi yêu cầu xác thực');
      }
    } catch (error) {
      console.error('Submit verification error:', error);
      alert('Có lỗi xảy ra khi gửi yêu cầu xác thực');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return '#28a745';
      case 'rejected': return '#dc3545';
      case 'pending': return '#ffc107';
      case 'under_review': return '#17a2b8';
      case 'requires_more_info': return '#fd7e14';
      default: return '#6c757d';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'approved': return 'Đã phê duyệt';
      case 'rejected': return 'Bị từ chối';
      case 'pending': return 'Chờ xem xét';
      case 'under_review': return 'Đang xem xét';
      case 'requires_more_info': return 'Cần bổ sung thông tin';
      default: return 'Không xác định';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved': return '✅';
      case 'rejected': return '❌';
      case 'pending': return '⏳';
      case 'under_review': return '👀';
      case 'requires_more_info': return '📋';
      default: return '❓';
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div>Đang tải trạng thái xác thực...</div>
      </div>
    );
  }

  if (!user || user.role !== 'housekeeper') {
    return null;
  }

  return (
    <div style={{
      backgroundColor: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      padding: '24px',
      margin: '20px 0',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
    }}>
      <h3 style={{ 
        margin: '0 0 20px 0', 
        color: '#1f2937',
        fontSize: '18px',
        fontWeight: '600'
      }}>
        🔐 Trạng thái xác thực tài khoản
      </h3>

      {verificationData?.hasRequest ? (
        <div>
          {/* Current Status */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <span style={{ fontSize: '24px' }}>
              {getStatusIcon(verificationData.request.status)}
            </span>
            <div>
              <div style={{ 
                fontWeight: '600', 
                color: getStatusColor(verificationData.request.status),
                fontSize: '16px'
              }}>
                {getStatusText(verificationData.request.status)}
              </div>
              <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
                Gửi lúc: {new Date(verificationData.request.submittedAt).toLocaleString('vi-VN')}
              </div>
            </div>
          </div>

          {/* Admin Notes */}
          {verificationData.request.adminNotes && (
            <div style={{
              padding: '12px',
              backgroundColor: '#fff3cd',
              border: '1px solid #ffeaa7',
              borderRadius: '6px',
              marginBottom: '16px'
            }}>
              <div style={{ fontWeight: '600', marginBottom: '4px', color: '#856404' }}>
                📝 Ghi chú từ Admin:
              </div>
              <div style={{ color: '#856404', fontSize: '14px' }}>
                {verificationData.request.adminNotes}
              </div>
            </div>
          )}

          {/* Documents Status */}
          {verificationData.documents && verificationData.documents.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#374151' }}>
                📄 Tài liệu đã gửi:
              </h4>
              <div style={{ display: 'grid', gap: '8px' }}>
                {verificationData.documents.map((doc, index) => (
                  <div key={index} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    backgroundColor: '#f3f4f6',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}>
                    <span>{doc.originalName}</span>
                    <span style={{ 
                      color: getStatusColor(doc.status),
                      fontWeight: '500'
                    }}>
                      {getStatusText(doc.status)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {(verificationData.request.status === 'requires_more_info' || 
              verificationData.request.status === 'rejected') && (
              <button
                onClick={() => setShowSubmitForm(true)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                📤 Gửi lại tài liệu
              </button>
            )}
            
            <button
              onClick={fetchVerificationStatus}
              style={{
                padding: '10px 20px',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              🔄 Làm mới
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div style={{
            padding: '20px',
            textAlign: 'center',
            backgroundColor: '#fef3c7',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚠️</div>
            <h4 style={{ margin: '0 0 8px 0', color: '#92400e' }}>
              Tài khoản chưa được xác thực
            </h4>
            <p style={{ margin: '0', color: '#92400e', fontSize: '14px' }}>
              Bạn cần gửi tài liệu xác thực để admin phê duyệt tài khoản housekeeper
            </p>
          </div>

          <button
            onClick={() => setShowSubmitForm(true)}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            📤 Gửi yêu cầu xác thực
          </button>
        </div>
      )}

      {/* Submit Form Modal */}
      {showSubmitForm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h3 style={{ margin: '0 0 20px 0' }}>📤 Gửi tài liệu xác thực</h3>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Ghi chú (tùy chọn):
              </label>
              <textarea
                value={submitForm.userNotes}
                onChange={(e) => setSubmitForm(prev => ({ ...prev, userNotes: e.target.value }))}
                placeholder="Thêm ghi chú cho admin..."
                rows="3"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 16px 0' }}>📄 Tài liệu cần thiết:</h4>
              
              <div style={{ display: 'grid', gap: '16px' }}>
                <UploadBox
                  label="CMND/CCCD mặt trước *"
                  file={submitForm.documents.find(d => d.type === 'id_card_front')?.originalName}
                  onChange={(file) => handleDocumentUpload(file, 'id_card_front')}
                  accept=".png,.jpg,.jpeg,.pdf"
                />
                
                <UploadBox
                  label="CMND/CCCD mặt sau *"
                  file={submitForm.documents.find(d => d.type === 'id_card_back')?.originalName}
                  onChange={(file) => handleDocumentUpload(file, 'id_card_back')}
                  accept=".png,.jpg,.jpeg,.pdf"
                />
                
                <UploadBox
                  label="Chứng chỉ/Bằng cấp (nếu có)"
                  file={submitForm.documents.find(d => d.type === 'certificate')?.originalName}
                  onChange={(file) => handleDocumentUpload(file, 'certificate')}
                  accept=".png,.jpg,.jpeg,.pdf"
                />
                
                <UploadBox
                  label="Bảo hiểm (nếu có)"
                  file={submitForm.documents.find(d => d.type === 'insurance')?.originalName}
                  onChange={(file) => handleDocumentUpload(file, 'insurance')}
                  accept=".png,.jpg,.jpeg,.pdf"
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowSubmitForm(false);
                  setSubmitForm({ userNotes: '', documents: [] });
                }}
                disabled={submitting}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Hủy
              </button>
              
              <button
                onClick={handleSubmitVerification}
                disabled={submitting || submitForm.documents.length === 0}
                style={{
                  padding: '10px 20px',
                  backgroundColor: submitting ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: submitting ? 'not-allowed' : 'pointer'
                }}
              >
                {submitting ? 'Đang gửi...' : 'Gửi yêu cầu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VerificationStatus;
