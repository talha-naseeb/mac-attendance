import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Feather } from '@expo/vector-icons';
import { buildLiveSlippyMapGrid } from '../services/locationSecurity';
import { ThemeColors } from '../theme/colors';

export interface LiveLocationMapProps {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  allowed: boolean;
  addressLabel: string;
  loadingLocation?: boolean;
  colors: ThemeColors;
}

/**
 * Native iOS & Android Map Component (`react-native-maps`).
 * - When `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` is configured in `.env`, renders
 *   the native Google Maps `<MapView provider={PROVIDER_GOOGLE}>` with `<Circle>`
 *   and `<Marker>`.
 * - On iOS without a Google key, Apple Maps (`PROVIDER_DEFAULT`) also works natively.
 * - On Android without `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`, falls back to the
 *   street-tile grid so Android never renders a blank Google screen.
 */
export const LiveLocationMap: React.FC<LiveLocationMapProps> = ({
  latitude,
  longitude,
  radiusMeters,
  allowed,
  addressLabel,
  loadingLocation = false,
  colors,
}) => {
  const mapRef = useRef<MapView | null>(null);
  const [viewport, setViewport] = useState({ width: 420, height: 225 });

  const hasGoogleMapsKey = Boolean(
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY &&
      process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY.trim().length > 0
  );

  // Use native MapView on iOS (Apple Maps or Google Maps) or on Android when Google Maps API Key is set
  const useNativeMapView = Platform.OS === 'ios' || hasGoogleMapsKey;

  useEffect(() => {
    if (useNativeMapView) {
      mapRef.current?.animateToRegion(
        {
          latitude,
          longitude,
          latitudeDelta: 0.0038,
          longitudeDelta: 0.0038,
        },
        450
      );
    }
  }, [latitude, longitude, useNativeMapView]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setViewport({ width, height });
    }
  };

  const grid = useMemo(
    () =>
      buildLiveSlippyMapGrid(latitude, longitude, {
        zoom: 16,
        isDark: colors.isDark,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
      }),
    [latitude, longitude, colors.isDark, viewport.width, viewport.height]
  );

  if (useNativeMapView) {
    return (
      <View style={styles.container}>
        <MapView
          ref={mapRef}
          provider={hasGoogleMapsKey ? PROVIDER_GOOGLE : undefined}
          style={StyleSheet.absoluteFill}
          initialRegion={{
            latitude,
            longitude,
            latitudeDelta: 0.0038,
            longitudeDelta: 0.0038,
          }}
          showsUserLocation={true}
          showsMyLocationButton={true}
          showsCompass={false}
          toolbarEnabled={false}
          userInterfaceStyle={colors.isDark ? 'dark' : 'light'}
        >
          <Circle
            center={{ latitude, longitude }}
            radius={radiusMeters}
            strokeWidth={2}
            strokeColor={allowed ? colors.primary : colors.dangerText}
            fillColor={
              allowed ? 'rgba(0, 44, 82, 0.16)' : 'rgba(220, 38, 38, 0.16)'
            }
          />
          <Marker coordinate={{ latitude, longitude }} title={addressLabel}>
            <View
              style={[
                styles.pinOuter,
                {
                  backgroundColor: allowed ? colors.accent : colors.dangerText,
                },
              ]}
            >
              <Feather name="map-pin" size={15} color={colors.textOnPrimary} />
            </View>
          </Marker>
        </MapView>
      </View>
    );
  }

  return (
    <View
      onLayout={handleLayout}
      style={[
        styles.container,
        {
          backgroundColor: colors.isDark ? colors.surfaceSubtle : '#E8EEF5',
        },
      ]}
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {grid.tiles.map((tile) => (
          <Image
            key={tile.key}
            source={{ uri: tile.url }}
            style={{
              position: 'absolute',
              left: tile.leftPx,
              top: tile.topPx,
              width: grid.tileSizePx,
              height: grid.tileSizePx,
            }}
            resizeMode="cover"
          />
        ))}
      </View>

      <View
        style={[
          styles.geofenceCircle,
          {
            borderColor: allowed ? colors.primary : colors.dangerText,
            backgroundColor: allowed
              ? `${colors.primary}24`
              : `${colors.dangerText}24`,
          },
        ]}
      >
        <View
          style={[
            styles.pinOuter,
            {
              backgroundColor: allowed ? colors.accent : colors.dangerText,
            },
          ]}
        >
          {loadingLocation ? (
            <ActivityIndicator size="small" color={colors.textOnPrimary} />
          ) : (
            <Feather name="map-pin" size={15} color={colors.textOnPrimary} />
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  geofenceCircle: {
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinOuter: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
});
