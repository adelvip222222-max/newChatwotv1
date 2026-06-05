import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';

async function generateTemplate(filename, sheetName, columns, rows) {
  const dir = path.join(process.cwd(), 'public', 'templates');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = columns;

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0D9488' } // Teal 600
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  rows.forEach(row => sheet.addRow(row));

  const filePath = path.join(dir, filename);
  await workbook.xlsx.writeFile(filePath);
  console.log('Template created at:', filePath);
}

async function main() {
  // 1. E-commerce
  await generateTemplate(
    'ecommerce-template.xlsx',
    'قالب المنتجات',
    [
      { header: 'اسم المنتج (مطلوب)', key: 'name', width: 30 },
      { header: 'الوصف (مطلوب)', key: 'description', width: 50 },
      { header: 'السعر', key: 'price', width: 15 },
      { header: 'القسم', key: 'category', width: 20 },
      { header: 'الرابط (URL)', key: 'url', width: 40 },
      { header: 'حالة التوفر', key: 'availability', width: 15 },
      { header: 'الأسئلة الشائعة حول المنتج', key: 'faq', width: 60 }
    ],
    [
      { name: 'حذاء رياضي مريح', description: 'حذاء مخصص للركض.', price: '250 ريال', category: 'أحذية رياضية', url: 'https://store.com/p/123', availability: 'متوفر', faq: 'س: هل يمكن غسله بالغسالة؟ ج: نعم.' }
    ]
  );

  // 2. Real Estate
  await generateTemplate(
    'realestate-template.xlsx',
    'قالب العقارات',
    [
      { header: 'اسم/رقم العقار (مطلوب)', key: 'name', width: 30 },
      { header: 'الموقع/الحي (مطلوب)', key: 'location', width: 30 },
      { header: 'السعر', key: 'price', width: 15 },
      { header: 'نوع العقار', key: 'type', width: 20 },
      { header: 'المساحة', key: 'area', width: 15 },
      { header: 'عدد الغرف', key: 'rooms', width: 15 },
      { header: 'وصف إضافي', key: 'description', width: 60 }
    ],
    [
      { name: 'فيلا فاخرة بمسبح', location: 'حي الياسمين، الرياض', price: '2,500,000 ريال', type: 'فيلا', area: '400 م²', rooms: '5', description: 'فيلا جديدة بتصميم عصري ومسبح داخلي.' }
    ]
  );

  // 3. Medical / Clinic
  await generateTemplate(
    'medical-template.xlsx',
    'قالب الخدمات الطبية',
    [
      { header: 'اسم الخدمة/الإجراء (مطلوب)', key: 'name', width: 30 },
      { header: 'الطبيب المختص', key: 'doctor', width: 30 },
      { header: 'السعر/الكشفية', key: 'price', width: 15 },
      { header: 'وصف الخدمة', key: 'description', width: 50 },
      { header: 'المدة المتوقعة', key: 'duration', width: 15 },
      { header: 'التعليمات قبل الموعد', key: 'instructions', width: 50 }
    ],
    [
      { name: 'تنظيف وتلميع الأسنان', doctor: 'د. أحمد محمود', price: '150 ريال', description: 'جلسة تنظيف جير شاملة وتلميع.', duration: '30 دقيقة', instructions: 'تجنب الأكل قبل الجلسة بساعة.' }
    ]
  );

  // 4. Tech Solutions / Software Company
  await generateTemplate(
    'tech-solutions-template.xlsx',
    'قالب الخدمات التقنية',
    [
      { header: 'اسم الخدمة/المنتج التقني (مطلوب)', key: 'name', width: 30 },
      { header: 'التقنيات المستخدمة', key: 'techStack', width: 30 },
      { header: 'باقة الأسعار', key: 'price', width: 30 },
      { header: 'وصف الحل التقني', key: 'description', width: 50 },
      { header: 'رابط ديمو/أعمال سابقة', key: 'demoUrl', width: 40 },
      { header: 'الأسئلة الشائعة للعملاء', key: 'faq', width: 60 }
    ],
    [
      { name: 'تطوير تطبيق متجر إلكتروني', techStack: 'React Native, Node.js', price: 'تبدأ من 15,000 ريال', description: 'تطبيق متكامل لـ iOS و Android مع لوحة تحكم.', demoUrl: 'https://agency.com/portfolio', faq: 'س: كم مدة التنفيذ؟ ج: شهرين تقريباً.' }
    ]
  );

}

main().catch(console.error);
