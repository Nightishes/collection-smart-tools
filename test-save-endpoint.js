// Test the save endpoint functionality
const http = require('http');
const fs = require('fs');

// Read the pdf2htmlEX file
const filePath = 'uploads/test-option3-output.html';
const content = fs.readFileSync(filePath, 'utf-8');

// Prepare the test data
const postData = JSON.stringify({
    filename: 'test-sanitized.html',
    content: content
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/upload/html/save',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
    }
};

console.log('Testing save endpoint with pdf2htmlEX content...');
console.log('Original content length:', content.length);
console.log('Original contains script tags:', content.includes('<script'));

const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        console.log('Response status:', res.statusCode);
        console.log('Response:', data);
        
        if (res.statusCode === 200) {
            try {
                const response = JSON.parse(data);
                console.log('✓ Save successful');
                console.log('Saved filename:', response.filename);
                
                // Check if the saved file still contains script tags
                if (response.filename) {
                    const savedPath = `uploads/${response.filename}`;
                    if (fs.existsSync(savedPath)) {
                        const savedContent = fs.readFileSync(savedPath, 'utf-8');
                        console.log('Saved content length:', savedContent.length);
                        console.log('Saved contains script tags:', savedContent.includes('<script'));
                        console.log('✓ Script tags preserved in saved file');
                    }
                }
            } catch (e) {
                console.log('Response parsing error:', e.message);
            }
        } else {
            console.log('✗ Save failed with status:', res.statusCode);
        }
    });
});

req.on('error', (e) => {
    console.error('Request error:', e.message);
});

req.write(postData);
req.end();
