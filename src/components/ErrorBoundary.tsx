import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { MACQUIRES_PALETTE } from '../theme/colors';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

/**
 * App-wide error boundary: shows a branded fallback screen instead of a
 * blank/crashed app, and lets the user retry rendering.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[MacqHR] Uncaught render error:', error, info.componentStack);
  }

  private handleRetry = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <View style={styles.iconSlot}>
            <Feather name="alert-triangle" size={28} color={MACQUIRES_PALETTE.orangePantone} />
          </View>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.titleAr}>حدث خطأ ما</Text>
          <Text style={styles.message} numberOfLines={3} ellipsizeMode="tail">
            {this.state.error.message}
          </Text>
          <TouchableOpacity style={styles.button} onPress={this.handleRetry}>
            <Feather name="refresh-cw" size={16} color={MACQUIRES_PALETTE.white} />
            <Text style={styles.buttonText}>Try again · إعادة المحاولة</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: MACQUIRES_PALETTE.oxfordBlue,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: MACQUIRES_PALETTE.white,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  iconSlot: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF1E8',
    marginBottom: 14,
  },
  title: { fontSize: 18, fontWeight: '800', color: MACQUIRES_PALETTE.oxfordBlue },
  titleAr: {
    fontSize: 16,
    fontWeight: '700',
    color: MACQUIRES_PALETTE.prussianBlue,
    marginTop: 4,
    lineHeight: 26,
  },
  message: {
    fontSize: 13,
    color: MACQUIRES_PALETTE.davysGrey,
    textAlign: 'center',
    marginVertical: 14,
    lineHeight: 19,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: MACQUIRES_PALETTE.prussianBlue,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  buttonText: { color: MACQUIRES_PALETTE.white, fontSize: 14, fontWeight: '800' },
});
