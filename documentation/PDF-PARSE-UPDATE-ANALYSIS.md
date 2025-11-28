# pdf-parse Update Analysis

_Date: November 28, 2025_

## 📊 Version Comparison

| Aspect              | v1.1.4 (Current)  | v2.4.5 (Latest)                   |
| ------------------- | ----------------- | --------------------------------- |
| **Release**         | Old (2019)        | Recent (Oct 2024)                 |
| **API Style**       | Simple function   | Class-based                       |
| **TypeScript**      | No built-in types | Built-in types ✅                 |
| **Node Support**    | 10.x+             | 20.x, 22.x, 23.x, 24.x            |
| **Browser Support** | Limited           | Full support ✅                   |
| **Features**        | Text only         | Text, Images, Tables, Screenshots |
| **Bundle Size**     | Small             | Larger (21.3 MB unpacked)         |

---

## 🔄 API Changes (Breaking)

### v1.x (Current Usage)

```typescript
import pdfParse from "pdf-parse";

const buffer = await fs.readFile("file.pdf");
const data = await pdfParse(buffer, {
  pagerender: (pageData) => {
    // Custom page rendering
  },
});

console.log(data.text);
console.log(data.numpages);
console.log(data.info);
```

### v2.x (New API)

```typescript
import { PDFParse } from "pdf-parse";

const parser = new PDFParse({
  data: buffer,
  // OR
  // url: 'https://example.com/file.pdf'
});

const result = await parser.getText();
console.log(result.text);

// IMPORTANT: Must call destroy() to free memory
await parser.destroy();
```

---

## 🛠️ Required Code Changes

### 1. **convert.ts** (Fallback conversion)

**Current Code** (Lines 283-340):

```typescript
const buf = await fs.readFile(inputAbs);
const data = await pdfParse(buf, {
  pagerender: (pageData: unknown) => {
    // Custom rendering logic
  },
});
```

**Migration to v2**:

```typescript
import { PDFParse } from "pdf-parse";

const buf = await fs.readFile(inputAbs);
const parser = new PDFParse({ data: buf });

try {
  const result = await parser.getText({
    // v2 doesn't support custom pagerender in the same way
    // Would need to use getInfo() and parse manually
  });

  // Process result.text
} finally {
  await parser.destroy(); // CRITICAL: Prevent memory leaks
}
```

**Issue**: Custom `pagerender` logic for formatting detection **NOT directly supported** in v2.

### 2. **pdf-to-txt/route.ts** (Simple text extraction)

**Current Code** (Line 48):

```typescript
const data = await pdfParse(buf);
return NextResponse.json({ success: true, content: data.text });
```

**Migration to v2**:

```typescript
import { PDFParse } from "pdf-parse";

const parser = new PDFParse({ data: buf });
try {
  const result = await parser.getText();
  return NextResponse.json({
    success: true,
    content: result.text,
  });
} finally {
  await parser.destroy();
}
```

**Impact**: ✅ Straightforward migration, minimal changes needed.

### 3. **pdf-to-docx/route.ts** (Fallback text extraction)

**Current Code** (Line 117+):

```typescript
const parsed = await PDFParser(buffer);
const text = parsed.text || "";
```

**Migration to v2**:

```typescript
import { PDFParse } from "pdf-parse";

const parser = new PDFParse({ data: buffer });
try {
  const result = await parser.getText();
  const text = result.text || "";
  // ... rest of code
} finally {
  await parser.destroy();
}
```

**Impact**: ✅ Simple migration.

---

## ⚠️ Critical Issues & Blockers

### 1. **Custom Page Rendering (BLOCKER)**

**Problem**: The current fallback in `convert.ts` uses custom `pagerender` function to:

- Detect font names (bold, italic, underline)
- Preserve line breaks based on Y-position
- Add HTML formatting (`<span>` tags with styles)

**v2 Status**:

- No direct equivalent for custom `pagerender`
- Would need to use `getInfo({ parsePageInfo: true })` and manually process
- Significant refactoring required

**Recommendation**: Keep v1 OR rewrite formatting detection logic entirely.

---

### 2. **Memory Management (CRITICAL)**

**New Requirement**: Must call `parser.destroy()` after each use

**Impact**:

- Every pdf-parse usage needs try/finally block
- Forgetting `destroy()` causes memory leaks
- More verbose code

**Example Pattern**:

```typescript
const parser = new PDFParse({ data: buffer });
try {
  const result = await parser.getText();
  // use result
  return result;
} finally {
  await parser.destroy(); // MUST CALL
}
```

---

### 3. **Node.js Version Requirements**

**Current Project**: Likely Node.js 18.x or 20.x

**v2 Requirements**:

- Officially supports: Node.js 20.x, 22.x, 23.x, 24.x
- NOT supported: Node.js 18.x, 19.x, 21.x
- Unsupported versions need "additional setup" (see troubleshooting)

**Risk**: May require Node.js upgrade or additional configuration.

---

### 4. **Bundle Size Increase**

- v1: ~1-2 MB
- v2: **21.3 MB unpacked** (110 files)

**Impact**:

- Larger Docker images
- Longer npm install times
- More disk space usage

---

## ✅ Benefits of Upgrading

### 1. **TypeScript Support**

- Built-in type definitions
- Better IDE autocomplete
- Type safety

### 2. **New Features** (Not currently used)

```typescript
// Extract images
const images = await parser.getImage();

// Extract tables
const tables = await parser.getTable();

// Render pages as PNG
const screenshot = await parser.getScreenshot({ scale: 1.5 });

// Get metadata
const info = await parser.getInfo();
```

### 3. **Better Error Handling**

```typescript
import { PasswordException, InvalidPDFException } from "pdf-parse";

try {
  const result = await parser.getText();
} catch (error) {
  if (error instanceof PasswordException) {
    // Handle password-protected PDFs
  } else if (error instanceof InvalidPDFException) {
    // Handle invalid PDFs
  }
}
```

### 4. **Browser Support**

- Can use in React/Vue/Angular
- CDN support
- Web workers

### 5. **Better Maintenance**

- Active development (Oct 2024 release)
- More features being added
- Security updates

---

## 🎯 Recommendation

### ⚠️ **DO NOT UPDATE** (For Now)

**Reasons**:

1. **Breaking API changes** require significant refactoring
2. **Custom pagerender logic** has no direct v2 equivalent
3. **Memory management** complexity (destroy() calls)
4. **Node.js version** requirements may need verification
5. **Bundle size increase** (21.3 MB) without current benefit
6. **Current v1 works perfectly** for text extraction needs

### Alternative Approach: **Hybrid Strategy**

Keep v1 for current functionality, add v2 only if new features needed:

```typescript
// Keep v1 for text extraction with custom formatting
import pdfParse_v1 from "pdf-parse"; // v1.1.4

// Add v2 for advanced features (images, tables)
import { PDFParse as PDFParse_v2 } from "pdf-parse-v2"; // install as separate package
```

---

## 📋 Migration Checklist (If You Decide to Update)

### Pre-Migration

- [ ] Verify Node.js version (20.x, 22.x, 23.x, or 24.x)
- [ ] Review custom pagerender logic requirements
- [ ] Test on sample PDFs in development
- [ ] Backup current working code

### Code Changes Required

- [ ] Update import statements (3 files)
- [ ] Change function calls to class instantiation
- [ ] Add try/finally blocks with destroy() calls
- [ ] Remove or refactor custom pagerender logic
- [ ] Update TypeScript type definitions

### Files to Modify

1. `package.json` - Update version
2. `src/types/pdf-parse.d.ts` - Remove (built-in types)
3. `src/app/api/upload/helpers/convert.ts` - Rewrite fallback (COMPLEX)
4. `src/app/api/convert/pdf-to-txt/route.ts` - Simple update
5. `src/app/api/convert/pdf-to-docx/route.ts` - Simple update

### Testing Required

- [ ] Test PDF text extraction (simple PDFs)
- [ ] Test PDF with formatting (bold, italic)
- [ ] Test large PDFs (200MB+)
- [ ] Test password-protected PDFs
- [ ] Test malformed PDFs
- [ ] Memory leak testing (multiple conversions)
- [ ] Docker build testing

### Post-Migration

- [ ] Update documentation
- [ ] Monitor memory usage
- [ ] Check for memory leaks
- [ ] Verify all error handling

---

## 💡 Estimated Effort

| Task                 | Time           | Difficulty      |
| -------------------- | -------------- | --------------- |
| Simple routes update | 1 hour         | Easy            |
| convert.ts refactor  | 4-8 hours      | Hard            |
| Testing              | 2-4 hours      | Medium          |
| Documentation        | 1 hour         | Easy            |
| **Total**            | **8-15 hours** | **Medium-High** |

---

## 🔍 Current Usage Summary

### Where pdf-parse is Used:

1. **convert.ts** (Fallback) - Complex custom rendering ⚠️
2. **pdf-to-txt/route.ts** - Simple text extraction ✅
3. **pdf-to-docx/route.ts** - Simple text extraction ✅

### Complexity Breakdown:

- **Simple updates**: 2 files (~1 hour)
- **Complex refactor**: 1 file (~8 hours)

---

## 📝 Conclusion

**Verdict**: Update is **technically possible but NOT recommended** at this time.

**Why**:

- Current v1 works perfectly for your needs
- v2 breaking changes require significant effort
- No immediate benefit (you don't use new features)
- Risk of introducing bugs in custom formatting logic
- Bundle size increase without value

**When to Consider Updating**:

- Need to extract images from PDFs
- Need to extract tables from PDFs
- Need to render PDF pages as images
- Node.js 18.x support drops and must upgrade
- Major security vulnerability found in v1

**Current Action**: **Keep v1.1.4** and mark as technical debt for future review.

---

## 🛡️ Security Consideration

Check for known vulnerabilities:

```powershell
npm audit | Select-String "pdf-parse"
```

If v1 has security issues, **then** prioritize update despite effort required.
