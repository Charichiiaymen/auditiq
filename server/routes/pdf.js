/**
 * PDF Route — POST /generate-pdf
 * Accepts auditData in request body, generates a pixel-perfect dark-themed PDF,
 * and streams it back as an attachment.
 */

const express = require('express')
const { buildPdfHtml } = require('../services/pdfTemplate')
const { generatePdf } = require('../services/pdfGenerator')

const router = express.Router()

router.post('/generate-pdf', async (req, res) => {
  try {
    const auditData = req.body

    if (!auditData || !auditData.url) {
      return res.status(400).json({ error: 'auditData with url is required' })
    }

    console.log(`[PDF] Generating report for: ${auditData.url}`)

    const html = buildPdfHtml(auditData)
    const pdfBuffer = await generatePdf(html)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="AuditIQ-Report.pdf"')
    res.setHeader('Content-Length', pdfBuffer.length)
    res.send(pdfBuffer)

    console.log(`[PDF] Report sent (${pdfBuffer.length} bytes)`)
  } catch (err) {
    console.error('[PDF] Generation failed:', err)
    res.status(500).json({ error: 'PDF generation failed', details: err.message })
  }
})

module.exports = router