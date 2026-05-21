const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

class ChatbotService {

  constructor() {
    // Kiểm tra xem có API key thực không
   const apiKey = process.env.GEMINI_API_KEY;

if (apiKey && apiKey !== 'gemini-test-key-placeholder') {
  this.ai = new GoogleGenAI({ apiKey });
  this.useRealAI = true;
  console.log('Gemini API initialized with real key');
} else {
  this.ai = null;
  this.useRealAI = false;
  console.log('Using mock AI responses (set GEMINI_API_KEY for real AI)');
}
    
    // Thông tin về dịch vụ và giá cả từ database
    this.services = {
      'Vệ sinh nhà cửa': {
        price: '60,000 - 100,000 VNĐ/giờ',
        description: 'Dọn dẹp, lau chùi, hút bụi toàn bộ ngôi nhà',
        duration: '2-4 giờ',
        combo: 'Gói tuần: 4 lần/tháng - Giảm 15%'
      },
      'Nấu ăn': {
        price: '80,000 - 120,000 VNĐ/giờ',
        description: 'Nấu các bữa ăn theo yêu cầu, mua sắm nguyên liệu',
        duration: '1-3 giờ',
        combo: 'Gói tháng: 20 bữa - Giảm 20%'
      },
      'Trông trẻ': {
        price: '50,000 - 80,000 VNĐ/giờ',
        description: 'Chăm sóc, vui chơi, giáo dục trẻ em',
        duration: '4-8 giờ',
        combo: 'Gói định kỳ: 3 lần/tuần - Giảm 25%'
      },
      'Giặt ủi': {
        price: '40,000 - 60,000 VNĐ/giờ',
        description: 'Giặt, phơi, ủi quần áo và đồ vải',
        duration: '2-3 giờ',
        combo: 'Gói tuần: 2 lần/tuần - Giảm 10%'
      },
      'Vệ sinh công nghiệp': {
        price: '70,000 - 150,000 VNĐ/giờ',
        description: 'Vệ sinh văn phòng, nhà xưởng, công trình',
        duration: '3-6 giờ',
        combo: 'Hợp đồng dài hạn: Giảm 30%'
      },
      'Chăm sóc người già': {
        price: '60,000 - 100,000 VNĐ/giờ',
        description: 'Chăm sóc, đồng hành, hỗ trợ sinh hoạt',
        duration: '4-12 giờ',
        combo: 'Gói chăm sóc 24/7: Ưu đãi đặc biệt'
      }
    };

    // Gói nâng cao và bảo hiểm
    this.premiumPackages = {
      'Bảo hiểm dịch vụ': {
        price: '50,000 VNĐ/tháng',
        benefits: ['Bồi thường thiệt hại', 'Hỗ trợ 24/7', 'Thay thế nhân viên miễn phí']
      },
      'Vệ sinh máy lạnh': {
        price: '300,000 - 500,000 VNĐ/lần',
        description: 'Vệ sinh chuyên sâu, bảo dưỡng máy lạnh',
        frequency: 'Nên thực hiện 2-3 tháng/lần'
      },
      'Gói nhà sạch mỗi tuần': {
        price: '800,000 - 1,200,000 VNĐ/tháng',
        description: 'Dọn dẹp định kỳ mỗi tuần, giữ nhà luôn sạch sẽ',
        includes: ['Vệ sinh tổng quát', 'Giặt ủi', 'Sắp xếp đồ đạc']
      }
    };

    // System prompt cho chatbot
    this.systemPrompt = `
Bạn là AI Assistant của HouseHelp - ứng dụng đặt dịch vụ giúp việc nhà hàng đầu Việt Nam.

NHIỆM VỤ CHÍNH:
1. Tư vấn dịch vụ: giúp khách hàng chọn dịch vụ phù hợp
2. Dự toán chi phí: tính toán chi phí dựa trên thời gian và dịch vụ
3. Gợi ý gói combo: đề xuất các gói tiết kiệm
4. Hỗ trợ khiếu nại: tiếp nhận và hướng dẫn khách hàng
5. Tư vấn gói nâng cao: bảo hiểm, vệ sinh máy lạnh, gói định kỳ
6. Hướng dẫn sử dụng app: giải thích các tính năng

NGUYÊN TẮC GIAO TIẾP:
- Luôn thân thiện, nhiệt tình
- Trả lời bằng tiếng Việt
- Đưa ra thông tin chính xác về giá cả và dịch vụ
- Gợi ý các gói combo để tiết kiệm chi phí
- Hỏi thêm thông tin khi cần thiết để tư vấn tốt hơn

THÔNG TIN DỊCH VỤ:
${JSON.stringify(this.services, null, 2)}

GÓI NÂNG CAO:
${JSON.stringify(this.premiumPackages, null, 2)}

Hãy trả lời một cách tự nhiên, hữu ích và luôn hướng khách hàng đến việc sử dụng dịch vụ HouseHelp.
`;
  }

  async processMessage(message, conversationHistory = [], userContext = {}) {
    try {
      
      // Phân tích intent để thực hiện actions
      const intent = await this.analyzeIntent(message);
      
      let botResponse;
      
      if (this.useRealAI && this.ai) {
        // Sử dụng OpenAI API thực
        try {
          const contextPrompt = this.buildContextPrompt(userContext);
const contents = [
  ...conversationHistory.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  })),
  {
    role: 'user',
    parts: [{ text: message }]
  }
];

const response = await this.ai.models.generateContent({
  model: process.env.CHATBOT_MODEL || 'gemini-2.5-flash',
  contents,
  config: {
    systemInstruction: this.systemPrompt + contextPrompt,
    maxOutputTokens: parseInt(process.env.CHATBOT_MAX_TOKENS) || 1000,
    temperature: parseFloat(process.env.CHATBOT_TEMPERATURE) || 0.7
  }
});

botResponse = response.text;
        } catch (aiError) {
          console.error('Chatbot AI provider error, falling back to mock:', aiError);
          botResponse = this.generateMockResponse(message, intent, userContext);
        }
      } else {
        // Sử dụng mock responses
        botResponse = this.generateMockResponse(message, intent, userContext);
      }
      
      return {
        response: botResponse,
        intent: intent,
        suggestions: this.generateSuggestions(intent, userContext)
      };

    } catch (error) {
      console.error('Chatbot service error:', error);
      return {
        response: 'Xin lỗi, tôi đang gặp sự cố kỹ thuật. Vui lòng thử lại sau hoặc liên hệ hỗ trợ khách hàng.',
        intent: 'error',
        suggestions: ['Thử lại', 'Liên hệ hỗ trợ']
      };
    }
  }

  generateMockResponse(message, intent, userContext) {
    const userName = userContext.name || 'bạn';
    const userRole = userContext.role || 'customer';
    
    
    // Role-specific responses
    if (userRole === 'housekeeper') {
      return this.getHousekeeperResponse(message, intent, userName);
    } else if (userRole === 'admin') {
      return this.getAdminResponse(message, intent, userName);
    }
    
    
    // Default customer responses
    const mockResponses = {
      'service_inquiry': `Chào ${userName}! Tôi hiểu bạn đang quan tâm đến dịch vụ giúp việc. HouseHelp cung cấp nhiều dịch vụ chất lượng cao:

🏠 **Vệ sinh nhà cửa**: 60,000 - 100,000 VNĐ/giờ
👨‍🍳 **Nấu ăn**: 80,000 - 120,000 VNĐ/giờ  
👶 **Trông trẻ**: 50,000 - 80,000 VNĐ/giờ
👔 **Giặt ủi**: 40,000 - 60,000 VNĐ/giờ

Bạn muốn tôi tư vấn chi tiết về dịch vụ nào không?`,

      'price_inquiry': `Tôi sẽ giúp bạn tính toán chi phí một cách chính xác! 💰

Chi phí sẽ phụ thuộc vào:
• Loại dịch vụ bạn chọn
• Thời gian thuê (giờ/ngày)
• Khu vực (có hệ số điều chỉnh)
• Tần suất sử dụng (có giảm giá)

Bạn có muốn tôi mở công cụ tính toán chi phí để ước tính chính xác không?`,

      'complaint': `Tôi rất tiếc khi biết bạn gặp vấn đề! 😔

HouseHelp cam kết giải quyết mọi khiếu nại một cách nhanh chóng và công bằng. Tôi sẽ hướng dẫn bạn quy trình khiếu nại:

1️⃣ Phân loại vấn đề
2️⃣ Mô tả chi tiết sự việc  
3️⃣ Upload bằng chứng (ảnh/video)
4️⃣ Nhận mã theo dõi

Chúng tôi sẽ phản hồi trong vòng 24 giờ. Bạn có muốn bắt đầu gửi khiếu nại không?`,

      'combo_inquiry': `Tuyệt vời! Các gói combo của HouseHelp giúp bạn tiết kiệm đáng kể! 📦

🌟 **Gói Nhà Sạch Tuần**: Vệ sinh + Giặt ủi - Giảm 15%
🍽️ **Gói Bữa Ăn Gia Đình**: Nấu ăn + Mua sắm - Giảm 20%  
👨‍👩‍👧‍👦 **Gói Chăm Sóc Toàn Diện**: Trông trẻ + Vệ sinh + Nấu ăn - Giảm 25%

Bạn muốn tôi tư vấn gói nào phù hợp với gia đình bạn không?`,

      'app_guide': `Tôi sẽ hướng dẫn bạn sử dụng app HouseHelp một cách hiệu quả! 📱

**Các tính năng chính:**
📝 Đăng ký và xác thực tài khoản
🔍 Tìm kiếm và đặt lịch dịch vụ
💬 Chat trực tiếp với housekeeper
💳 Thanh toán an toàn, minh bạch
⭐ Đánh giá và phản hồi

Bạn muốn tôi mở hướng dẫn chi tiết từng bước không?`,

      'general': `Xin chào ${userName}! Tôi là AI Assistant của HouseHelp. 👋

Tôi có thể hỗ trợ bạn:
• Tư vấn chọn dịch vụ phù hợp
• Tính toán chi phí dự kiến  
• Gợi ý gói combo tiết kiệm
• Hỗ trợ khiếu nại
• Hướng dẫn sử dụng app

Bạn cần hỗ trợ gì hôm nay?`
    };

    return mockResponses[intent] || mockResponses['general'];
  }

  getHousekeeperResponse(message, intent, userName) {
    
    const housekeeperResponses = {
      'service_inquiry': `Chào Housekeeper ${userName}! 👋

Tôi hiểu bạn muốn tối ưu hóa dịch vụ của mình. Đây là những gợi ý:

📋 **Quản lý đơn hàng hiệu quả**
💰 **Tối ưu giá cả cạnh tranh** 
⭐ **Nâng cao đánh giá 5 sao**
💬 **Cải thiện giao tiếp khách hàng**

Bạn muốn tôi hỗ trợ vấn đề nào?`,

      'price_inquiry': `Tôi sẽ giúp bạn tối ưu hóa giá dịch vụ! 💰

**Chiến lược định giá thông minh:**
• Phân tích giá thị trường theo khu vực
• Điều chỉnh giá theo thời gian cao điểm
• Tạo gói combo hấp dẫn khách hàng
• Cân bằng giữa cạnh tranh và lợi nhuận

Bạn có muốn tôi mở công cụ tối ưu giá không?`,

      'general': `Xin chào Housekeeper ${userName}! 👋

Tôi là AI Assistant dành riêng cho Housekeeper. Tôi có thể hỗ trợ bạn:

📋 Quản lý đơn hàng và lịch làm việc
💰 Tối ưu hóa giá dịch vụ
⭐ Cải thiện đánh giá và hiệu suất  
💬 Xử lý quan hệ khách hàng
📚 Hướng dẫn sử dụng app

Bạn cần hỗ trợ gì hôm nay?`
    };

    const response = housekeeperResponses[intent] || housekeeperResponses['general'] || `Chào Housekeeper ${userName}! 👋

Tôi là AI Assistant dành cho Housekeeper. Tôi có thể hỗ trợ bạn:

📋 Quản lý đơn hàng và lịch làm việc
💰 Tối ưu hóa giá dịch vụ
⭐ Cải thiện đánh giá và hiệu suất
💬 Giao tiếp hiệu quả với khách hàng
📚 Hướng dẫn sử dụng app Housekeeper
🛡️ Hỗ trợ giải quyết vấn đề

Bạn cần hỗ trợ gì hôm nay?`;

    return response;
  }

  generateSuggestions(intent, userContext) {
    const userRole = userContext.role || 'customer';
    console.log('🎯 GENERATE SUGGESTIONS - userRole:', userRole);
    console.log('🎯 GENERATE SUGGESTIONS - intent:', intent);
    
    if (userRole === 'housekeeper') {
      console.log('✅ Returning housekeeper suggestions');
      return [
        'Quản lý đơn hàng',
        'Tối ưu giá dịch vụ', 
        'Cải thiện đánh giá',
        'Hướng dẫn app Housekeeper',
        'Giải quyết vấn đề với khách'
      ];
    } else if (userRole === 'admin') {
      console.log('✅ Returning admin suggestions');
      return [
        'Phân tích dữ liệu',
        'Quản lý người dùng',
        'Báo cáo hệ thống',
        'Xử lý khiếu nại',
        'Cấu hình hệ thống'
      ];
    }
    
    // Default customer suggestions
    console.log('✅ Returning customer suggestions');
    return [
      'Tư vấn dịch vụ dọn dẹp',
      'Tính chi phí thuê giúp việc',
      'Gói combo tiết kiệm', 
      'Hướng dẫn sử dụng app',
      'Hỗ trợ khiếu nại',
      'Gói nâng cao'
    ];
  }

  getAdminResponse(message, intent, userName) {
    const adminResponses = {
      'service_inquiry': `Chào Admin ${userName}! 👋

Tôi có thể hỗ trợ bạn quản lý hệ thống:

📊 **Phân tích dữ liệu và báo cáo**
👥 **Quản lý người dùng và Housekeeper**
🔧 **Cấu hình hệ thống**
🛡️ **Xử lý khiếu nại cấp cao**

Bạn cần hỗ trợ vấn đề nào?`,

      'complaint': `Tôi sẽ hỗ trợ bạn xử lý khiếu nại cấp Admin! 🛡️

**Quy trình xử lý:**
• Phân tích mức độ nghiêm trọng
• Điều tra và thu thập bằng chứng
• Đưa ra quyết định xử lý
• Thông báo kết quả cho các bên

Bạn có muốn tôi mở công cụ xử lý khiếu nại không?`,

      'general': `Xin chào Admin ${userName}! 👋

Tôi là AI Assistant dành cho Admin. Tôi có thể hỗ trợ bạn:

📊 Phân tích dữ liệu hệ thống
👥 Quản lý người dùng
🔧 Cấu hình hệ thống
📈 Báo cáo và thống kê
🛡️ Xử lý khiếu nại

Bạn cần hỗ trợ gì hôm nay?`
    };

    return adminResponses[intent] || adminResponses['general'];
  }

  buildContextPrompt(userContext) {
    let context = '\n\nTHÔNG TIN KHÁCH HÀNG:\n';
    
    if (userContext.name) {
      context += `- Tên: ${userContext.name}\n`;
    }
    
    if (userContext.location) {
      context += `- Địa chỉ: ${userContext.location}\n`;
    }
    
    if (userContext.previousBookings) {
      context += `- Đã sử dụng dịch vụ: ${userContext.previousBookings.join(', ')}\n`;
    }
    
    if (userContext.preferences) {
      context += `- Sở thích: ${userContext.preferences}\n`;
    }

    return context;
  }

  async analyzeIntent(message) {
    const intents = {
      'service_inquiry': ['dịch vụ', 'làm gì', 'giúp việc', 'dọn dẹp', 'nấu ăn', 'trông trẻ'],
      'price_inquiry': ['giá', 'chi phí', 'tiền', 'bao nhiêu', 'cost'],
      'booking': ['đặt', 'book', 'thuê', 'lịch hẹn'],
      'complaint': ['khiếu nại', 'phжалоба', 'không hài lòng', 'vấn đề', 'sự cố'],
      'combo_inquiry': ['gói', 'combo', 'ưu đãi', 'giảm giá', 'tiết kiệm'],
      'premium_inquiry': ['bảo hiểm', 'máy lạnh', 'định kỳ', 'nâng cao'],
      'app_guide': ['hướng dẫn', 'cách dùng', 'sử dụng app', 'làm sao']
    };

    const lowerMessage = message.toLowerCase();
    
    for (const [intent, keywords] of Object.entries(intents)) {
      if (keywords.some(keyword => lowerMessage.includes(keyword))) {
        return intent;
      }
    }
    
    return 'general';
  }

  calculateEstimatedCost(service, duration, location = 'TP.HCM') {
    const serviceInfo = this.services[service];
    if (!serviceInfo) return null;

    // Parse giá từ string (lấy giá trung bình)
    const priceRange = serviceInfo.price.match(/([0-9,]+)/g);
    if (!priceRange || priceRange.length < 2) return null;

    const minPrice = parseInt(priceRange[0].replace(/,/g, ''));
    const maxPrice = parseInt(priceRange[1].replace(/,/g, ''));
    const avgPrice = (minPrice + maxPrice) / 2;

    // Tính chi phí dự kiến
    const baseCost = avgPrice * duration;
    
    // Áp dụng hệ số theo khu vực
    const locationMultiplier = this.getLocationMultiplier(location);
    const estimatedCost = baseCost * locationMultiplier;

    return {
      service: service,
      duration: duration,
      baseCost: baseCost,
      locationMultiplier: locationMultiplier,
      estimatedCost: Math.round(estimatedCost),
      formattedCost: this.formatCurrency(estimatedCost),
      breakdown: {
        hourlyRate: avgPrice,
        hours: duration,
        locationAdjustment: locationMultiplier
      }
    };
  }

  getLocationMultiplier(location) {
    const multipliers = {
      'Quận 1': 1.3,
      'Quận 3': 1.2,
      'Quận 7': 1.1,
      'TP.HCM': 1.0,
      'Hà Nội': 1.1,
      'Đà Nẵng': 0.9,
      'Cần Thơ': 0.8
    };

    for (const [area, multiplier] of Object.entries(multipliers)) {
      if (location.includes(area)) {
        return multiplier;
      }
    }

    return 1.0; // Default
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  }

  getComboRecommendations(services) {
    const combos = [];

    if (services.includes('Vệ sinh nhà cửa')) {
      combos.push({
        name: 'Gói Nhà Sạch Tuần',
        services: ['Vệ sinh nhà cửa', 'Giặt ủi'],
        frequency: '1 lần/tuần',
        discount: '15%',
        monthlyPrice: '800,000 VNĐ'
      });
    }

    if (services.includes('Nấu ăn')) {
      combos.push({
        name: 'Gói Bữa Ăn Gia Đình',
        services: ['Nấu ăn', 'Mua sắm'],
        frequency: '5 ngày/tuần',
        discount: '20%',
        monthlyPrice: '1,200,000 VNĐ'
      });
    }

    if (services.includes('Trông trẻ')) {
      combos.push({
        name: 'Gói Chăm Sóc Toàn Diện',
        services: ['Trông trẻ', 'Vệ sinh nhà cửa', 'Nấu ăn'],
        frequency: '3 lần/tuần',
        discount: '25%',
        monthlyPrice: '2,000,000 VNĐ'
      });
    }

    return combos;
  }
}

module.exports = ChatbotService;
