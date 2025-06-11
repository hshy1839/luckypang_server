const Faq = require('../models/Faq'); // Faq 모델 경로 확인

// FAQ 추가
exports.createFaq = async (req, res) => {
  try {
    const { category, question, answer } = req.body;

    if (!category || !question || !answer) {
      return res.status(400).json({
        success: false,
        message: '카테고리, 질문, 답변은 모두 필수입니다.',
      });
    }

    const faq = new Faq({ category, question, answer });
    const savedFaq = await faq.save();

    return res.status(201).json({
      success: true,
      message: 'FAQ가 성공적으로 추가되었습니다.',
      faq: savedFaq,
    });
  } catch (err) {
    console.error('FAQ 추가 오류:', err);
    return res.status(500).json({
      success: false,
      message: 'FAQ 추가 중 서버 오류가 발생했습니다.',
      error: err.message,
    });
  }
};

// 전체 FAQ 조회
exports.getAllFaqs = async (req, res) => {
  try {
    const faqs = await Faq.find().sort({ createdAt: -1 }); // 최신순 정렬
    return res.status(200).json({
      success: true,
      faqs,
    });
  } catch (err) {
    console.error('FAQ 전체 조회 오류:', err);
    return res.status(500).json({
      success: false,
      message: 'FAQ 목록을 불러오는 중 오류가 발생했습니다.',
      error: err.message,
    });
  }
};

// 특정 FAQ 조회
exports.getFaqById = async (req, res) => {
  try {
    const { id } = req.params;
    const faq = await Faq.findById(id);
    if (!faq) {
      return res.status(404).json({
        success: false,
        message: '해당 FAQ를 찾을 수 없습니다.',
      });
    }

    return res.status(200).json({
      success: true,
      faq,
    });
  } catch (err) {
    console.error('FAQ 단일 조회 오류:', err);
    return res.status(500).json({
      success: false,
      message: 'FAQ 조회 중 오류가 발생했습니다.',
      error: err.message,
    });
  }
};

// FAQ 삭제
exports.deleteFaq = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedFaq = await Faq.findByIdAndDelete(id);
    if (!deletedFaq) {
      return res.status(404).json({
        success: false,
        message: '해당 FAQ를 찾을 수 없습니다.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'FAQ가 성공적으로 삭제되었습니다.',
    });
  } catch (err) {
    console.error('FAQ 삭제 오류:', err);
    return res.status(500).json({
      success: false,
      message: 'FAQ 삭제 중 서버 오류가 발생했습니다.',
      error: err.message,
    });
  }
};
exports.updateFaq = async (req, res) => {
    try {
      const { id } = req.params;
      const { category, question, answer } = req.body;
  
      if (!category || !question || !answer) {
        return res.status(400).json({
          success: false,
          message: '카테고리, 질문, 답변은 모두 필수입니다.',
        });
      }
  
      const updatedFaq = await Faq.findByIdAndUpdate(
        id,
        { category, question, answer },
        { new: true } // 업데이트 후 변경된 데이터 반환
      );
  
      if (!updatedFaq) {
        return res.status(404).json({
          success: false,
          message: '해당 FAQ를 찾을 수 없습니다.',
        });
      }
  
      return res.status(200).json({
        success: true,
        message: 'FAQ가 성공적으로 수정되었습니다.',
        faq: updatedFaq,
      });
    } catch (err) {
      console.error('FAQ 수정 오류:', err);
      return res.status(500).json({
        success: false,
        message: 'FAQ 수정 중 서버 오류가 발생했습니다.',
        error: err.message,
      });
    }
  };