import { calculateHaversineDistanceMeters, isWithinGeofence } from './haversine.util';

describe('Haversine Geofence Utility', () => {
  // Riyadh HQ Coordinates
  const riyadhHqLat = 24.7136;
  const riyadhHqLng = 46.6753;

  it('calculates zero distance for exact same coordinates', () => {
    const distance = calculateHaversineDistanceMeters(
      riyadhHqLat,
      riyadhHqLng,
      riyadhHqLat,
      riyadhHqLng,
    );
    expect(distance).toBe(0);
  });

  it('validates employee inside 150m geofence radius', () => {
    // 50 meters north of HQ: ~0.00045 degrees lat difference
    const userLat = 24.7140;
    const userLng = 46.6753;

    const result = isWithinGeofence(userLat, userLng, riyadhHqLat, riyadhHqLng, 150);
    expect(result.isInside).toBe(true);
    expect(result.distanceMeters).toBeLessThanOrEqual(150);
  });

  it('rejects employee outside 150m geofence radius', () => {
    // 500 meters away
    const userLat = 24.7180;
    const userLng = 46.6753;

    const result = isWithinGeofence(userLat, userLng, riyadhHqLat, riyadhHqLng, 150);
    expect(result.isInside).toBe(false);
    expect(result.distanceMeters).toBeGreaterThan(150);
  });
});
