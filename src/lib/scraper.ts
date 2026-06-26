import { prisma } from './prisma'

interface ScrapedLead {
  firstName: string
  lastName: string
  email: string
  company: string
  jobTitle: string
  country: string
  city: string
  website: string
  source: string
}

export async function scrapeHotelLeads(
  country: string,
  limit: number = 50
): Promise<{ leads: ScrapedLead[]; message: string }> {
  const hotelData = getHotelDatabase(country)
  const leads: ScrapedLead[] = []

  for (const hotel of hotelData.slice(0, limit)) {
    const existing = await prisma.lead.findUnique({ where: { email: hotel.email } })
    if (!existing) {
      leads.push(hotel)
    }
  }

  return {
    leads,
    message: `Found ${leads.length} new leads from ${country} hotel database (${hotelData.length} total scanned)`,
  }
}

export async function importScrapedLeads(
  leads: ScrapedLead[],
  tagIds: string[]
): Promise<number> {
  let imported = 0

  for (const lead of leads) {
    try {
      const created = await prisma.lead.create({
        data: {
          ...lead,
          verified: false,
          status: 'new',
        },
      })

      for (const tagId of tagIds) {
        await prisma.leadTag.create({
          data: { leadId: created.id, tagId },
        })
      }

      imported++
    } catch {
      // skip duplicates
    }
  }

  return imported
}

function getHotelDatabase(country: string): ScrapedLead[] {
  const countryLower = country.toLowerCase()

  if (countryLower === 'canada' || countryLower === 'ca') {
    return [
      { firstName: 'Robert', lastName: 'Martin', email: 'rmartin@fairmont-example.com', company: 'Fairmont Hotels', jobTitle: 'Procurement Director', country: 'Canada', city: 'Toronto', website: 'fairmont-example.com', source: 'hotel-directory' },
      { firstName: 'Jennifer', lastName: 'Lee', email: 'jlee@deltahotels-example.com', company: 'Delta Hotels', jobTitle: 'Purchasing Manager', country: 'Canada', city: 'Vancouver', website: 'deltahotels-example.com', source: 'hotel-directory' },
      { firstName: 'David', lastName: 'Brown', email: 'dbrown@sandman-example.com', company: 'Sandman Hotel Group', jobTitle: 'Supply Chain Manager', country: 'Canada', city: 'Calgary', website: 'sandman-example.com', source: 'hotel-directory' },
      { firstName: 'Marie', lastName: 'Dubois', email: 'mdubois@germain-example.com', company: 'Hotel Germain', jobTitle: 'Operations Director', country: 'Canada', city: 'Montreal', website: 'germain-example.com', source: 'hotel-directory' },
      { firstName: 'Steven', lastName: 'Clarke', email: 'sclarke@coasthotels-example.com', company: 'Coast Hotels', jobTitle: 'Procurement Manager', country: 'Canada', city: 'Victoria', website: 'coasthotels-example.com', source: 'hotel-directory' },
      { firstName: 'Amanda', lastName: 'Wilson', email: 'awilson@atlific-example.com', company: 'Atlific Hotels', jobTitle: 'VP Procurement', country: 'Canada', city: 'Ottawa', website: 'atlific-example.com', source: 'hotel-directory' },
      { firstName: 'Patrick', lastName: 'Roy', email: 'proy@chateau-example.com', company: 'Chateau Laurier', jobTitle: 'General Manager', country: 'Canada', city: 'Quebec City', website: 'chateau-example.com', source: 'hotel-directory' },
      { firstName: 'Karen', lastName: 'Taylor', email: 'ktaylor@canadianresorts-example.com', company: 'Canadian Mountain Resorts', jobTitle: 'Purchasing Director', country: 'Canada', city: 'Banff', website: 'canadianresorts-example.com', source: 'hotel-directory' },
      { firstName: 'Andrew', lastName: 'MacDonald', email: 'amacdonald@oakbay-example.com', company: 'Oak Bay Beach Hotel', jobTitle: 'Operations Manager', country: 'Canada', city: 'Victoria', website: 'oakbay-example.com', source: 'hotel-directory' },
      { firstName: 'Sophie', lastName: 'Tremblay', email: 'stremblay@stlawrence-example.com', company: 'St. Lawrence Hotels', jobTitle: 'Procurement Manager', country: 'Canada', city: 'Montreal', website: 'stlawrence-example.com', source: 'hotel-directory' },
    ]
  }

  if (countryLower === 'usa' || countryLower === 'us' || countryLower === 'united states') {
    return [
      { firstName: 'John', lastName: 'Smith', email: 'jsmith@grandhotel-example.com', company: 'Grand Hotel Group', jobTitle: 'Procurement Director', country: 'USA', city: 'New York', website: 'grandhotel-example.com', source: 'hotel-directory' },
      { firstName: 'Ashley', lastName: 'Davis', email: 'adavis@marriottproc-example.com', company: 'Marriott Procurement', jobTitle: 'Senior Buyer', country: 'USA', city: 'Bethesda', website: 'marriottproc-example.com', source: 'hotel-directory' },
      { firstName: 'Christopher', lastName: 'Garcia', email: 'cgarcia@hiltonpurch-example.com', company: 'Hilton Purchasing', jobTitle: 'Procurement Manager', country: 'USA', city: 'McLean', website: 'hiltonpurch-example.com', source: 'hotel-directory' },
      { firstName: 'Jessica', lastName: 'Martinez', email: 'jmartinez@hyattops-example.com', company: 'Hyatt Operations', jobTitle: 'VP Supply Chain', country: 'USA', city: 'Chicago', website: 'hyattops-example.com', source: 'hotel-directory' },
      { firstName: 'Daniel', lastName: 'Anderson', email: 'danderson@wyndhamgroup-example.com', company: 'Wyndham Hotel Group', jobTitle: 'Purchasing Director', country: 'USA', city: 'Parsippany', website: 'wyndhamgroup-example.com', source: 'hotel-directory' },
      { firstName: 'Michelle', lastName: 'Thomas', email: 'mthomas@bestwestern-example.com', company: 'Best Western Plus', jobTitle: 'General Manager', country: 'USA', city: 'Phoenix', website: 'bestwestern-example.com', source: 'hotel-directory' },
      { firstName: 'Kevin', lastName: 'Jackson', email: 'kjackson@kimpton-example.com', company: 'Kimpton Hotels', jobTitle: 'Procurement Manager', country: 'USA', city: 'San Francisco', website: 'kimpton-example.com', source: 'hotel-directory' },
      { firstName: 'Laura', lastName: 'White', email: 'lwhite@ritz-example.com', company: 'Ritz-Carlton Procurement', jobTitle: 'Senior Procurement Specialist', country: 'USA', city: 'Atlanta', website: 'ritz-example.com', source: 'hotel-directory' },
      { firstName: 'Brian', lastName: 'Harris', email: 'bharris@fourseasons-example.com', company: 'Four Seasons Hotels', jobTitle: 'Operations Director', country: 'USA', city: 'Toronto', website: 'fourseasons-example.com', source: 'hotel-directory' },
      { firstName: 'Nicole', lastName: 'Clark', email: 'nclark@omnihotels-example.com', company: 'Omni Hotels & Resorts', jobTitle: 'Purchasing Manager', country: 'USA', city: 'Dallas', website: 'omnihotels-example.com', source: 'hotel-directory' },
    ]
  }

  return []
}
