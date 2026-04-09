/**
 * test-pdfs/create-test-pdfs.ts
 *
 * Generates realistic test PDF files for manual testing of Local Redact.
 *
 * Usage:
 *   npx tsx test-pdfs/create-test-pdfs.ts
 *
 * Generated PDFs:
 *   test-pdfs/w2-sample.pdf       — Mock W-2 tax form
 *   test-pdfs/bank-statement.pdf  — Mock 2-page bank statement
 *   test-pdfs/medical-record.pdf  — Mock medical summary
 */

import { jsPDF } from 'jspdf'
import { writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __filenameESM = fileURLToPath(import.meta.url)
const OUTPUT_DIR = dirname(__filenameESM)

/** Helper: save a jsPDF doc to disk */
function savePDF(doc: jsPDF, filename: string): void {
  const buffer = doc.output('arraybuffer') as ArrayBuffer
  const filepath = join(OUTPUT_DIR, filename)
  writeFileSync(filepath, Buffer.from(buffer))
  console.log(`  ✓ ${filename} (${Math.round(buffer.byteLength / 1024)} KB)`)
}

/** Helper: draw a horizontal rule */
function drawHR(doc: jsPDF, y: number, x1 = 50, x2 = 562): number {
  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.5)
  doc.line(x1, y, x2, y)
  return y + 8
}

/** Helper: draw a box outline */
function drawBox(doc: jsPDF, x: number, y: number, w: number, h: number): void {
  doc.setDrawColor(100, 100, 100)
  doc.setLineWidth(0.75)
  doc.rect(x, y, w, h)
}

// ─── W-2 Tax Form ───────────────────────────────────────────────────

function createW2(): void {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const leftMargin = 50
  const rightCol = 310

  // Title area
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Form W-2', leftMargin, 50)

  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(11)
  doc.text('Wage and Tax Statement 2024', leftMargin + 80, 50)

  doc.setFontSize(8)
  doc.text('Department of the Treasury — Internal Revenue Service', leftMargin, 64)

  let y = drawHR(doc, 76)

  // ── Box layout: Employer info (left) / Control number area (right) ──

  // Box a — Employee SSN
  drawBox(doc, leftMargin, y, 250, 44)
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('a  Employee\'s social security number', leftMargin + 4, y + 10)
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('412-67-9823', leftMargin + 4, y + 32)

  // Box b — Employer EIN
  drawBox(doc, rightCol, y, 252, 44)
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('b  Employer identification number (EIN)', rightCol + 4, y + 10)
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('36-7291045', rightCol + 4, y + 32)

  y += 52

  // Box c — Employer name & address
  drawBox(doc, leftMargin, y, 512, 60)
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('c  Employer\'s name, address, and ZIP code', leftMargin + 4, y + 10)
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Northwest Digital Solutions LLC', leftMargin + 4, y + 26)
  doc.text('500 Commerce Blvd, Suite 200', leftMargin + 4, y + 38)
  doc.text('Seattle, WA 98101', leftMargin + 4, y + 50)

  y += 68

  // Box e — Employee name
  drawBox(doc, leftMargin, y, 512, 36)
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('e  Employee\'s first name and initial       Last name', leftMargin + 4, y + 10)
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(11)
  doc.text('Sarah Mitchell', leftMargin + 4, y + 28)

  y += 44

  // Box f — Employee address
  drawBox(doc, leftMargin, y, 512, 48)
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('f  Employee\'s address and ZIP code', leftMargin + 4, y + 10)
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('1847 Oakridge Drive', leftMargin + 4, y + 26)
  doc.text('Portland, OR 97205', leftMargin + 4, y + 38)

  y += 56

  // Contact info row
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Phone: (503) 555-0147', leftMargin, y)
  doc.text('Email: sarah.mitchell@email.com', rightCol, y)
  y += 20

  y = drawHR(doc, y)

  // ── Wage and tax boxes (2-column grid) ──
  const boxW = 250
  const boxH = 40
  const col1 = leftMargin
  const col2 = rightCol

  // Row 1: Box 1 & 2
  drawBox(doc, col1, y, boxW, boxH)
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('1  Wages, tips, other compensation', col1 + 4, y + 10)
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('$87,432.00', col1 + 4, y + 30)

  drawBox(doc, col2, y, boxW + 2, boxH)
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('2  Federal income tax withheld', col2 + 4, y + 10)
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('$14,263.00', col2 + 4, y + 30)

  y += boxH + 4

  // Row 2: Box 3 & 4
  drawBox(doc, col1, y, boxW, boxH)
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('3  Social security wages', col1 + 4, y + 10)
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('$87,432.00', col1 + 4, y + 30)

  drawBox(doc, col2, y, boxW + 2, boxH)
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('4  Social security tax withheld', col2 + 4, y + 10)
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('$5,420.78', col2 + 4, y + 30)

  y += boxH + 4

  // Row 3: Box 5 & 6
  drawBox(doc, col1, y, boxW, boxH)
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('5  Medicare wages and tips', col1 + 4, y + 10)
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('$87,432.00', col1 + 4, y + 30)

  drawBox(doc, col2, y, boxW + 2, boxH)
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('6  Medicare tax withheld', col2 + 4, y + 10)
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('$1,267.76', col2 + 4, y + 30)

  y += boxH + 4

  // Row 4: State tax
  drawBox(doc, col1, y, boxW, boxH)
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('17  State income tax', col1 + 4, y + 10)
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('$6,108.00', col1 + 4, y + 30)

  drawBox(doc, col2, y, boxW + 2, boxH)
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('15  State / Employer\'s state ID number', col2 + 4, y + 10)
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('OR  36-7291045', col2 + 4, y + 30)

  y += boxH + 20

  // Footer
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('Form W-2 (2024)  •  This is a sample document for testing purposes only.', leftMargin, y)

  savePDF(doc, 'w2-sample.pdf')
}

// ─── Bank Statement (2 pages) ───────────────────────────────────────

function createBankStatement(): void {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const leftMargin = 50
  const rightMargin = 562

  // ── Page 1 ──

  // Bank header
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('First National Bank', leftMargin, 50)

  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Member FDIC  |  Equal Housing Lender', leftMargin, 64)
  doc.text('P.O. Box 8400, Chicago, IL 60680', leftMargin, 76)

  let y = drawHR(doc, 90)

  // Statement title
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('Monthly Account Statement', leftMargin, y + 10)
  y += 14

  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Statement Period: March 1, 2024 – March 31, 2024', leftMargin, y + 12)
  y += 28

  y = drawHR(doc, y)

  // Account holder info (left) / Account details (right)
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Account Holder', leftMargin, y + 6)

  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('James Rodriguez', leftMargin, y + 20)
  doc.text('2234 Elm Street', leftMargin, y + 32)
  doc.text('Austin, TX 78701', leftMargin, y + 44)

  doc.setFont('Helvetica', 'bold')
  doc.text('Account Details', 350, y + 6)

  doc.setFont('Helvetica', 'normal')
  doc.text('Account Number: 4829103756', 350, y + 20)
  doc.text('Routing Number: 021000021', 350, y + 32)
  doc.text('Account Type: Personal Checking', 350, y + 44)

  y += 60
  y = drawHR(doc, y)

  // Account summary
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Account Summary', leftMargin, y + 10)
  y += 22

  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(10)

  const summaryData = [
    ['Opening Balance (03/01/2024)', '$12,847.33'],
    ['Total Deposits & Credits', '$5,240.00'],
    ['Total Withdrawals & Debits', '-$4,128.67'],
    ['Closing Balance (03/31/2024)', '$13,958.66'],
  ]

  for (const [label, value] of summaryData) {
    doc.text(label, leftMargin + 10, y)
    doc.text(value, 460, y, { align: 'right' })
    y += 16
  }

  y += 8
  y = drawHR(doc, y)

  // Transactions header
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Transaction Details', leftMargin, y + 10)
  y += 24

  // Table header
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Date', leftMargin + 10, y)
  doc.text('Description', 140, y)
  doc.text('Amount', 440, y, { align: 'right' })
  doc.text('Balance', 530, y, { align: 'right' })
  y += 4
  y = drawHR(doc, y)

  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(9)

  const transactions1 = [
    ['03/01', 'Direct Deposit — Northwest Digital Solutions', '+$3,480.00', '$16,327.33'],
    ['03/03', 'Debit Card — Whole Foods Market #1042', '-$127.43', '$16,199.90'],
    ['03/05', 'Online Transfer — Rent Payment', '-$1,850.00', '$14,349.90'],
    ['03/07', 'Debit Card — Shell Gas Station', '-$48.72', '$14,301.18'],
    ['03/08', 'ACH Payment — AT&T Wireless', '-$89.99', '$14,211.19'],
    ['03/10', 'Debit Card — Amazon.com', '-$234.56', '$13,976.63'],
    ['03/12', 'Check #1247 — Dr. Patterson DDS', '-$175.00', '$13,801.63'],
    ['03/14', 'Venmo Transfer Received', '+$120.00', '$13,921.63'],
    ['03/15', 'Direct Deposit — Northwest Digital Solutions', '+$3,480.00', '$17,401.63'],
  ]

  for (const [date, desc, amount, balance] of transactions1) {
    doc.text(date, leftMargin + 10, y)
    doc.text(desc, 140, y)
    doc.text(amount, 440, y, { align: 'right' })
    doc.text(balance, 530, y, { align: 'right' })
    y += 15
  }

  // Footer on page 1
  doc.setFontSize(7)
  doc.setFont('Helvetica', 'normal')
  doc.text('Page 1 of 2', 306, 750, { align: 'center' })

  // ── Page 2 ──
  doc.addPage('letter')

  // Page 2 header
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('First National Bank — Statement (continued)', leftMargin, 40)
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Account Number: 4829103756', leftMargin, 54)
  doc.text('Statement Period: March 1 – 31, 2024', 350, 54)

  y = drawHR(doc, 64)

  // Continue table header
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Date', leftMargin + 10, y + 4)
  doc.text('Description', 140, y + 4)
  doc.text('Amount', 440, y + 4, { align: 'right' })
  doc.text('Balance', 530, y + 4, { align: 'right' })
  y += 8
  y = drawHR(doc, y)

  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(9)

  const transactions2 = [
    ['03/17', 'Debit Card — Target Store #0392', '-$67.81', '$17,333.82'],
    ['03/18', 'ACH Payment — Progressive Insurance', '-$142.50', '$17,191.32'],
    ['03/19', 'Debit Card — Starbucks #14209', '-$12.45', '$17,178.87'],
    ['03/20', 'Online Bill Pay — Austin Energy', '-$183.42', '$16,995.45'],
    ['03/22', 'Debit Card — H-E-B Grocery', '-$98.34', '$16,897.11'],
    ['03/24', 'ACH Payment — Netflix', '-$15.99', '$16,881.12'],
    ['03/25', 'Wire Transfer Received — Tax Refund', '+$1,640.00', '$18,521.12'],
    ['03/27', 'Debit Card — Home Depot #4401', '-$312.78', '$18,208.34'],
    ['03/28', 'Online Transfer — Savings Account', '-$2,000.00', '$16,208.34'],
    ['03/29', 'Debit Card — Costco Wholesale', '-$245.89', '$15,962.45'],
    ['03/30', 'ACH Payment — Student Loan (Navient)', '-$389.00', '$15,573.45'],
    ['03/31', 'Monthly Service Fee', '-$12.00', '$15,561.45'],
    ['03/31', 'Interest Earned', '+$2.21', '$15,563.66'],
  ]

  for (const [date, desc, amount, balance] of transactions2) {
    doc.text(date, leftMargin + 10, y)
    doc.text(desc, 140, y)
    doc.text(amount, 440, y, { align: 'right' })
    doc.text(balance, 530, y, { align: 'right' })
    y += 15
  }

  y += 8
  y = drawHR(doc, y)

  // Closing balance
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Closing Balance as of 03/31/2024:', leftMargin + 10, y + 8)
  doc.text('$13,958.66', 460, y + 8, { align: 'right' })

  y += 30
  y = drawHR(doc, y)

  // Contact info
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Customer Service', leftMargin, y + 10)
  y += 22

  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('For questions about your account, please contact us:', leftMargin, y)
  y += 16
  doc.text('Phone: (800) 555-0199', leftMargin + 10, y)
  y += 14
  doc.text('Email: support@firstnational.com', leftMargin + 10, y)
  y += 14
  doc.text('Online Banking: www.firstnationalbank.com', leftMargin + 10, y)
  y += 14
  doc.text('Branch Locations: Visit our website for the nearest branch', leftMargin + 10, y)

  y += 30
  y = drawHR(doc, y)

  // Disclaimer
  doc.setFontSize(7)
  doc.text(
    'Please review your statement carefully. Report any discrepancies within 60 days of the statement date.',
    leftMargin,
    y + 6,
  )
  doc.text(
    'First National Bank  |  FDIC Insured  |  Equal Housing Lender  |  NMLS# 402761',
    leftMargin,
    y + 16,
  )

  // Footer page 2
  doc.text('Page 2 of 2', 306, 750, { align: 'center' })

  savePDF(doc, 'bank-statement.pdf')
}

// ─── Medical Record ─────────────────────────────────────────────────

function createMedicalRecord(): void {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const leftMargin = 50

  // Clinic header
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Rocky Mountain Health Partners', leftMargin, 50)

  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('4500 Colorado Boulevard, Suite 310  •  Denver, CO 80220', leftMargin, 64)
  doc.text('Phone: (303) 555-0178  •  Fax: (303) 555-0179', leftMargin, 76)

  let y = drawHR(doc, 90)

  // Document title
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('Patient Medical Summary', leftMargin, y + 12)
  y += 16

  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Visit Date: January 15, 2025', leftMargin, y + 10)
  y += 20

  y = drawHR(doc, y)

  // Patient Information section
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Patient Information', leftMargin, y + 10)
  y += 22

  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(10)

  const patientInfo = [
    ['Patient Name:', 'Emily Chen'],
    ['Date of Birth:', '03/15/1985'],
    ['SSN:', '298-45-6712'],
    ['Address:', '789 Maple Avenue, Denver, CO 80202'],
    ['Phone:', '(720) 555-0234'],
    ['Emergency Contact:', 'David Chen (Spouse) — (720) 555-0235'],
  ]

  for (const [label, value] of patientInfo) {
    doc.setFont('Helvetica', 'bold')
    doc.text(label, leftMargin + 10, y)
    doc.setFont('Helvetica', 'normal')
    doc.text(value, 170, y)
    y += 16
  }

  y += 4
  y = drawHR(doc, y)

  // Insurance Information
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Insurance Information', leftMargin, y + 10)
  y += 22

  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(10)

  const insuranceInfo = [
    ['Provider:', 'Blue Cross Blue Shield of Colorado'],
    ['Policy Number:', 'BCBS-7849201365'],
    ['Group Number:', 'GRP-44821'],
    ['Subscriber:', 'Emily Chen'],
    ['Copay:', '$45.00'],
  ]

  for (const [label, value] of insuranceInfo) {
    doc.setFont('Helvetica', 'bold')
    doc.text(label, leftMargin + 10, y)
    doc.setFont('Helvetica', 'normal')
    doc.text(value, 170, y)
    y += 16
  }

  y += 4
  y = drawHR(doc, y)

  // Attending Physician
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Attending Physician', leftMargin, y + 10)
  y += 22

  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Dr. Rebecca Lawson, MD — Internal Medicine', leftMargin + 10, y)
  y += 14
  doc.text('NPI: 1234567890', leftMargin + 10, y)

  y += 20
  y = drawHR(doc, y)

  // Chief Complaint & Diagnosis
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Chief Complaint', leftMargin, y + 10)
  y += 22

  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Patient presents with persistent fatigue, intermittent headaches, and mild', leftMargin + 10, y)
  y += 14
  doc.text('dizziness over the past three weeks. Reports difficulty concentrating at work.', leftMargin + 10, y)
  y += 14
  doc.text('No recent travel, no known sick contacts. Denies chest pain or shortness of breath.', leftMargin + 10, y)

  y += 22
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Diagnosis', leftMargin, y)
  y += 16

  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('1. Iron deficiency anemia (ICD-10: D50.9)', leftMargin + 10, y)
  y += 14
  doc.text('2. Vitamin D deficiency (ICD-10: E55.9)', leftMargin + 10, y)
  y += 14
  doc.text('3. Tension-type headache (ICD-10: G44.2)', leftMargin + 10, y)

  y += 22
  y = drawHR(doc, y)

  // Prescriptions
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Prescriptions', leftMargin, y + 10)
  y += 22

  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(10)

  const prescriptions = [
    'Ferrous Sulfate 325mg — Take 1 tablet by mouth daily with food',
    'Vitamin D3 2000 IU — Take 1 capsule by mouth daily',
    'Ibuprofen 400mg — Take as needed for headache, max 3 per day',
  ]

  for (let i = 0; i < prescriptions.length; i++) {
    doc.text(`${i + 1}. ${prescriptions[i]}`, leftMargin + 10, y)
    y += 14
  }

  y += 4
  doc.setFont('Helvetica', 'bold')
  doc.text('Patient Copay: $45.00', leftMargin + 10, y)

  y += 20
  y = drawHR(doc, y)

  // Follow-up
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Follow-Up', leftMargin, y + 10)
  y += 22

  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Next Appointment: February 26, 2025 at 10:30 AM', leftMargin + 10, y)
  y += 14
  doc.text('Lab work (CBC, Iron panel, Vitamin D level) to be completed 1 week prior to visit.', leftMargin + 10, y)
  y += 14
  doc.text('Patient advised to increase dietary iron intake and maintain hydration.', leftMargin + 10, y)

  y += 30

  // Signature line
  y = drawHR(doc, y)
  doc.setFont('Helvetica', 'italic')
  doc.setFontSize(10)
  doc.text('Electronically signed by Dr. Rebecca Lawson, MD', leftMargin, y + 8)
  doc.text('January 15, 2025', leftMargin, y + 20)

  // Footer
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(7)
  doc.text(
    'CONFIDENTIAL: This document contains protected health information (PHI). Unauthorized disclosure is prohibited.',
    leftMargin,
    750,
  )

  savePDF(doc, 'medical-record.pdf')
}

// ─── Main ───────────────────────────────────────────────────────────

function main(): void {
  console.log('Creating test PDF files...\n')

  createW2()
  createBankStatement()
  createMedicalRecord()

  console.log('\nAll test PDFs created successfully.')
}

main()
