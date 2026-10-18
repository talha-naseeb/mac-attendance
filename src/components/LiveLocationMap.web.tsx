import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  LayoutChangeEvent,
  StyleSheet,
  View,
} from 'react-native';
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

export const LiveLocationMap: React.FC<LiveLocationMapProps> = ({
  latitude,
  longitude,
  allowed,
  loadingLocation = false,
  colors,
}) => {
  const [viewport, setViewport] = useState({ width: 420, height: 225 });

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
