import test from 'node:test'
import assert from 'node:assert/strict'
import { SAMPLE_LOCATIONS, isSampleLocation, resolveSampleMoment } from '../src/sampleLocationFallback.ts'
import { photoFitStyle, withSkyPhotoBalance } from '../src/frameSkyBalance.ts'

const chicago = SAMPLE_LOCATIONS[0]
test('sample Chicago resolves correct daylight-saving local time without Azure Maps', () => {
  assert.equal(isSampleLocation(chicago), true)
  assert.equal(resolveSampleMoment('2024-07-04','21:00',false,chicago).utcDateTime,
    '2024-07-05T02:00:00.000Z')
  assert.equal(resolveSampleMoment('2024-01-10','21:00',false,chicago).utcDateTime,
    '2024-01-11T03:00:00.000Z')
  assert.equal(resolveSampleMoment('2024-07-04',null,true,chicago).utcDateTime,null)
})

test('sample city fallback detects DST nonexistent and repeated hours',()=>{
  assert.throws(() => resolveSampleMoment('2024-03-10','02:30',false,chicago),
    /does not exist/)
  assert.throws(() => resolveSampleMoment('2024-11-03','01:30',false,chicago),
    /occurs twice/)
  assert.throws(() => resolveSampleMoment('2024-02-30','21:00',false,chicago),
    /valid date/)
})

test('international city uses its actual IANA time zone and limits trusted presets',()=>{
  const tokyo=SAMPLE_LOCATIONS.find(x=>x.displayName==='Tokyo')
  assert.ok(tokyo)
  assert.equal(resolveSampleMoment('2024-07-04','21:00',false,tokyo).utcDateTime,
    '2024-07-04T12:00:00.000Z')
  assert.equal(isSampleLocation({...chicago,latitude:41.9}),false)
})

const spec = {
  regions: {
    sky: {xMm:6,yMm:6,widthMm:200,heightMm:120,label:'sky'},
    engravingPhoto: {xMm:6,yMm:134,widthMm:200,heightMm:180,label:'photo'},
    text: {xMm:6,yMm:323,widthMm:200,heightMm:30,label:'text'},
  },
  photo:{ positionMm:{xMm:6,yMm:134,widthMm:200,heightMm:180},fitMode:'contain' },
  stars:[{hipparcosId:1,xMm:20,yMm:66,altitudeDeg:40,azimuthDeg:10}],
}
test('sky-height control reallocates existing frame without changing catalog values',()=>{
  const smaller=withSkyPhotoBalance(spec,20)
  const taller=withSkyPhotoBalance(spec,70)
  assert.ok(smaller.regions.sky.heightMm<taller.regions.sky.heightMm)
  assert.ok(smaller.regions.engravingPhoto.heightMm>taller.regions.engravingPhoto.heightMm)
  assert.equal(smaller.regions.text.yMm,323)
  assert.equal(taller.stars[0].hipparcosId,1)
  assert.equal(taller.stars[0].altitudeDeg,40)
  assert.equal(spec.regions.sky.heightMm,120,'original spec must be unchanged')
})

test('photo fitting respects intended crop direction without modifying source',()=>{
  assert.deepEqual(photoFitStyle('fit'),{objectFit:'contain',objectPosition:'center center'})
  assert.deepEqual(photoFitStyle('top-crop'),{objectFit:'cover',objectPosition:'center bottom'})
  assert.deepEqual(photoFitStyle('bottom-crop'),{objectFit:'cover',objectPosition:'center top'})
  assert.equal(photoFitStyle('stretch').objectFit,'fill')
})

import { matchCityRows, isOfflineCity } from '../src/offlineCitySearch.ts'
import { readFile } from 'node:fs/promises'

test('type a city name to find geocoded city candidates with time zones', () => {
  const rows=[
    ['Chicago','','America/Chicago','US',2664452,41.85,-87.65],
    ['Chicago Heights','','America/Chicago','US',27500,41.5,-87.6],
    ['Napa','','America/Los_Angeles','US',79000,38.29,-122.29],
    ['Paris','','Europe/Paris','FR',2138551,48.8534,2.3488],
    ['Paris','','America/Chicago','US',25000,33.66,-95.55],
  ]
  const found=matchCityRows(rows,'Chicago')
  assert.equal(found[0].displayName,'Chicago')
  assert.equal(found[0].timeZoneId,'America/Chicago')
  assert.equal(isOfflineCity(found[0]),true)
  assert.equal(matchCityRows(rows,'Paris, France')[0].timeZoneId,'Europe/Paris')
  assert.equal(matchCityRows(rows,'Paris, US')[0].timeZoneId,'America/Chicago')
  assert.equal(matchCityRows(rows,'NA')[0].displayName,'Napa')
  assert.deepEqual(matchCityRows(rows,'nonexistent'),[])
})

test('the licensed place database contains thousands of independently searchable real cities', async () => {
  const raw=await readFile(new URL('../public/data/cities15000.json',import.meta.url),'utf-8')
  const data=JSON.parse(raw)
  assert.ok(data.cities.length>30000)
  assert.ok(data.source.includes('GeoNames'))
  const places=matchCityRows(data.cities,'Bolingbrook')
  assert.equal(places[0].timeZoneId,'America/Chicago')
  assert.equal(places[0].countryCode,undefined)
  assert.equal(places[0].latitude>41 && places[0].longitude< -87,true)
})
