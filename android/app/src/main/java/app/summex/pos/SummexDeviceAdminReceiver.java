package app.summex.pos;

import android.app.admin.DeviceAdminReceiver;

/**
 * Production kiosk: set as Device Owner (or Knox) so lock-task is silent.
 * Training uses Samsung pin-windows / startLockTask prompt instead.
 */
public class SummexDeviceAdminReceiver extends DeviceAdminReceiver {}
