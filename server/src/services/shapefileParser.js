import { readFile } from "node:fs/promises";

const POLYGON_TYPES = new Set([5, 15, 25]);
const COUNTY_NAME_FIELDS = ["COUNTY", "COUNTY_NAM", "COUNTYNAME", "COUNTY_NAME", "NAME", "COUNTY_N"];

export async function loadCountyAoisFromShapefile({ shpPath, dbfPath }) {
  const [shpBuffer, dbfBuffer] = await Promise.all([
    readFile(shpPath),
    dbfPath ? readFile(dbfPath).catch(() => null) : Promise.resolve(null)
  ]);
  const features = parseShpBuffer(shpBuffer);
  const names = dbfBuffer ? parseDbfNames(dbfBuffer) : [];

  return features.map((feature, index) => ({
    name: names[index] || `County ${index + 1}`,
    geometry: feature.geometry
  }));
}

export function parseAoiGeometryFromShp(buffer) {
  const features = parseShpBuffer(buffer);
  if (!features.length) {
    throw new Error("Shapefile did not contain polygon records");
  }

  const geometries = features.map((feature) => feature.geometry);
  return geometries.length === 1 ? geometries[0] : { type: "GeometryCollection", geometries };
}

export function parseShpBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 100) {
    throw new Error("Invalid shapefile header");
  }

  const fileCode = buffer.readInt32BE(0);
  const version = buffer.readInt32LE(28);
  if (fileCode !== 9994 || version !== 1000) {
    throw new Error("Invalid shapefile signature");
  }

  const fileShapeType = buffer.readInt32LE(32);
  if (!POLYGON_TYPES.has(fileShapeType)) {
    throw new Error("Only polygon shapefiles are supported");
  }

  const features = [];
  let offset = 100;
  while (offset + 8 <= buffer.length) {
    const contentLength = buffer.readInt32BE(offset + 4) * 2;
    const contentOffset = offset + 8;
    const nextOffset = contentOffset + contentLength;
    if (contentLength < 4 || nextOffset > buffer.length) {
      throw new Error("Invalid shapefile record length");
    }

    const shapeType = buffer.readInt32LE(contentOffset);
    if (shapeType !== 0) {
      if (!POLYGON_TYPES.has(shapeType)) {
        throw new Error("Only polygon records are supported");
      }
      features.push({ type: "Feature", properties: {}, geometry: parsePolygonRecord(buffer, contentOffset) });
    }
    offset = nextOffset;
  }

  return features;
}

function parsePolygonRecord(buffer, contentOffset) {
  const numParts = buffer.readInt32LE(contentOffset + 36);
  const numPoints = buffer.readInt32LE(contentOffset + 40);
  const partsOffset = contentOffset + 44;
  const pointsOffset = partsOffset + numParts * 4;
  if (numParts < 1 || numPoints < 3 || pointsOffset + numPoints * 16 > buffer.length) {
    throw new Error("Invalid polygon geometry");
  }

  const parts = [];
  for (let index = 0; index < numParts; index += 1) {
    parts.push(buffer.readInt32LE(partsOffset + index * 4));
  }

  const rings = parts.map((start, index) => {
    const end = parts[index + 1] ?? numPoints;
    const ring = [];
    for (let pointIndex = start; pointIndex < end; pointIndex += 1) {
      const pointOffset = pointsOffset + pointIndex * 16;
      ring.push([buffer.readDoubleLE(pointOffset), buffer.readDoubleLE(pointOffset + 8)]);
    }
    return closeRing(ring);
  }).filter((ring) => ring.length >= 4);

  if (!rings.length) {
    throw new Error("Polygon record does not contain valid rings");
  }

  return rings.length === 1
    ? { type: "Polygon", coordinates: [rings[0]] }
    : { type: "MultiPolygon", coordinates: rings.map((ring) => [ring]) };
}

function closeRing(ring) {
  if (!ring.length) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) {
    return ring;
  }
  return [...ring, first];
}

function parseDbfNames(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 33) return [];

  const recordCount = buffer.readUInt32LE(4);
  const headerLength = buffer.readUInt16LE(8);
  const recordLength = buffer.readUInt16LE(10);
  const fields = [];

  for (let offset = 32; offset + 32 <= headerLength && buffer[offset] !== 0x0d; offset += 32) {
    const rawName = buffer.subarray(offset, offset + 11).toString("latin1").replace(/\0/g, "").trim();
    const length = buffer[offset + 16];
    const displacement = fields.reduce((sum, field) => sum + field.length, 1);
    if (rawName) fields.push({ name: rawName.toUpperCase(), length, displacement });
  }

  const nameField = COUNTY_NAME_FIELDS
    .map((fieldName) => fields.find((field) => field.name === fieldName))
    .find(Boolean) || fields.find((field) => field.name.includes("COUNTY")) || fields.find((field) => field.name.includes("NAME"));

  if (!nameField) return [];

  const names = [];
  for (let index = 0; index < recordCount; index += 1) {
    const recordOffset = headerLength + index * recordLength;
    if (recordOffset + recordLength > buffer.length || buffer[recordOffset] === 0x2a) continue;
    const value = buffer
      .subarray(recordOffset + nameField.displacement, recordOffset + nameField.displacement + nameField.length)
      .toString("latin1")
      .trim();
    names.push(value);
  }

  return names;
}
