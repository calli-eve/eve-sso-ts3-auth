const https = require('https')

const ESI_BASE = 'https://esi.evetech.net/latest'

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'ts3-auth/1.0 (contact your-admin@example.com)' } }, (res) => {
      let body = ''
      res.on('data', d => body += d)
      res.on('end', () => {
        if (res.statusCode >= 400) {
          return reject(new Error(`ESI error ${res.statusCode} for ${url}: ${body}`))
        }
        try { resolve(JSON.parse(body)) }
        catch (e) { reject(new Error(`ESI JSON parse error: ${e.message}`)) }
      })
    }).on('error', reject)
  })
}

async function getCharacterInfo(characterId) {
  return get(`${ESI_BASE}/characters/${characterId}/`)
}

async function getCorporationInfo(corporationId) {
  return get(`${ESI_BASE}/corporations/${corporationId}/`)
}

async function getAllianceInfo(allianceId) {
  return get(`${ESI_BASE}/alliances/${allianceId}/`)
}

module.exports = { getCharacterInfo, getCorporationInfo, getAllianceInfo }
