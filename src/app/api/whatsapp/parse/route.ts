import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

// Flexible, case/space/underscore-insensitive column matcher.
function findColumn(row: Record<string, unknown>, names: string[]): string {
  const norm = (s: string) => s.toLowerCase().replace(/[_\s-]/g, '')
  for (const name of names) {
    for (const key of Object.keys(row)) {
      if (norm(key) === norm(name)) {
        const v = row[key]
        return v === undefined || v === null ? '' : String(v).trim()
      }
    }
  }
  return ''
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      return NextResponse.json({ error: 'No sheets found in file' }, { status: 400 })
    }
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)
    if (rows.length === 0) {
      return NextResponse.json({ error: 'No data rows found in the file' }, { status: 400 })
    }

    const parsed = rows.map((row, i) => {
      const firstName = findColumn(row, ['First Name', 'FirstName', 'First_Name', 'Name'])
      const lastName = findColumn(row, ['Last Name', 'LastName', 'Last_Name'])
      const cardType = findColumn(row, ['Card_Type', 'Card Type', 'CardType', 'Card', 'Product'])
      const trackingNo = findColumn(row, ['Tracking No', 'Tracking_No', 'TrackingNo', 'Tracking', 'Tracking Number', 'AWB', 'Tracking Number'])
      const mobile = findColumn(row, ['Mobile_no', 'Mobile No', 'Mobile', 'Phone', 'Mobile Number', 'Number', 'Contact', 'Whatsapp'])
      return {
        index: i,
        firstName,
        lastName,
        cardType,
        trackingNo,
        mobile,
        // keep any extra columns so the user can use them as tags if needed
        raw: row,
      }
    })

    const withNumbers = parsed.filter((r) => r.mobile.replace(/[^0-9]/g, '').length >= 8)

    return NextResponse.json({
      total: parsed.length,
      valid: withNumbers.length,
      columns: Object.keys(rows[0]),
      rows: parsed,
    })
  } catch (error) {
    console.error('WhatsApp parse failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to read the file. Use .xlsx or .csv.' },
      { status: 500 }
    )
  }
}
