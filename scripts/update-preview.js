const fs = require('fs');
let content = fs.readFileSync('src/app/preview/page.tsx', 'utf8');

// The function is named ChatWidget and ends right before "Main Preview Page"
const startIdx = content.indexOf('function ChatWidget(');
const endIdx = content.indexOf('// ─── Main Preview Page');

if (startIdx !== -1 && endIdx !== -1) {
    const before = content.substring(0, startIdx);
    const after = content.substring(endIdx);
    const updated = before + "import { ChatWidget } from '@/components/ui/chat-widget';\n\n" + after;
    fs.writeFileSync('src/app/preview/page.tsx', updated);
    console.log("Success");
} else {
    console.log("Failed to find boundaries");
}
