import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mocked } from 'jest-mock';

import * as _constants from '../../../common/constants';
import { Settings } from '../../../common/settings';
import * as models from '../../../models';
import * as settingsHelpers from '../settings';
import {
  getConfigFile,
  getConfigSettings as _getConfigSettings,
  getControlledStatus,
  getLocalDevConfigFilePath,
  getMonkeyPatchedControlledSettings,
  omitControlledSettings,
} from '../settings';

jest.mock('../../../common/constants', () => ({
  ...jest.requireActual('../../../common/constants') as typeof _constants,
  isDevelopment: jest.fn(),
}));
const { isDevelopment } = mocked(_constants);

jest.mock('../settings');
const getConfigSettings = mocked(_getConfigSettings);

describe('getLocalDevConfigFilePath', () => {
  it('will not return the local dev config path in production mode', () => {
    isDevelopment.mockReturnValue(false);
    expect(getLocalDevConfigFilePath()).toEqual(undefined);
  });

  it('will return the local dev config path in development mode', () => {
    isDevelopment.mockReturnValue(true);
    expect(getLocalDevConfigFilePath()).toContain('insomnia/src');
  });
});

describe('getConfigFile', () => {
  beforeEach(() => {
    jest.spyOn(settingsHelpers, 'readConfigFile').mockImplementation(e => e);
  });

  afterAll(jest.resetAllMocks);
  it('prioritizes portable config location over all others', () => {
    jest.spyOn(settingsHelpers, 'getLocalDevConfigFilePath').mockReturnValue('localDev');

    const result = getConfigFile();

    expect(result.configPath).toContain('insomnia.config.json');
  });

  it('prioritizes insomnia data directory over local dev when portable config is not found', () => {
    jest.spyOn(settingsHelpers, 'getLocalDevConfigFilePath').mockReturnValue('localDev');

    const result = getConfigFile();

    expect(result.configPath).toContain('insomnia.config.json');
  });

  it('returns the local dev config file if no others are found', () => {
    jest.spyOn(settingsHelpers, 'getLocalDevConfigFilePath').mockReturnValue('localDev');

    const result = getConfigFile();

    expect(result.configPath).toContain('insomnia.config.json');
  });
});

describe('getControlledStatus', () => {
  it('should override conflicting setting if controlled by another setting', () => {
    getConfigSettings.mockReturnValue({});
    const settings: Settings = {
      ...models.settings.init(),
      incognitoMode: true,
      enableAnalytics: true, // this intentionally conflicts with incognito mode
    };

    const controlledStatus = getControlledStatus(settings)('enableAnalytics');

    expect(controlledStatus).toStrictEqual({
      isControlled: true,
      controller: 'incognitoMode',
      value: false,
    });
  });

  it('should override setting with what is defined in the config file', () => {
    getConfigSettings.mockReturnValue({ enableAnalytics: false });
    const settings: Settings = {
      ...models.settings.init(),
      incognitoMode: false, // ensures incognito mode isn't affecting this test
      enableAnalytics: true, // this intentionally conflicts with the config
    };

    const controlledStatus = getControlledStatus(settings)('enableAnalytics');

    expect(controlledStatus).toStrictEqual({
      isControlled: true,
      controller: 'insomnia-config',
      value: false,
    });
  });

  it('should override setting controlled by another setting, with what is defined in the config file', () => {
    getConfigSettings.mockReturnValue({ enableAnalytics: true }); // intentionally conflicts with incognito mode
    const settings: Settings = {
      ...models.settings.init(),
      incognitoMode: true, // this intentionally conflicts with the config
      enableAnalytics: false, // this intentionally conflicts with the config
    };

    const controlledStatus = getControlledStatus(settings)('enableAnalytics');

    expect(controlledStatus).toStrictEqual({
      isControlled: true,
      controller: 'insomnia-config',
      value: true,
    });
  });
});

describe('omitControlledSettings', () => {
  it('omits config controlled settings', () => {
    getConfigSettings.mockReturnValue({ disablePaidFeatureAds: true });
    const settings = models.settings.init();

    const result = omitControlledSettings(settings, { disablePaidFeatureAds: false });

    expect(result).not.toHaveProperty('disablePaidFeatureAds');
  });

  it('does not omit settings not controlled by the config', () => {
    getConfigSettings.mockReturnValue({});
    const settings = models.settings.init();

    const result = omitControlledSettings(settings, { disablePaidFeatureAds: true });

    expect(result).toMatchObject({ disablePaidFeatureAds: true });
  });

  it('omits settings controlled by other settings', () => {
    getConfigSettings.mockReturnValue({});
    const settings: Settings = {
      ...models.settings.init(),
      incognitoMode: true,
    };
    const result = omitControlledSettings(settings, {
      enableAnalytics: true,
      allowNotificationRequests: true,
    });

    expect(result).not.toHaveProperty('enableAnalytics');
    expect(result).not.toHaveProperty('allowNotificationRequests');
  });

  it('does not omit settings not controlled by other settings', () => {
    getConfigSettings.mockReturnValue({});
    const settings = models.settings.init();
    const result = omitControlledSettings(settings, { disablePaidFeatureAds: true });

    expect(result).toMatchObject({ disablePaidFeatureAds: true });
  });
});

describe('getMonkeyPatchedControlledSettings', () => {
  it('overwrites config controlled settings', () => {
    getConfigSettings.mockReturnValue({ disablePaidFeatureAds: true });
    const settings: Settings = {
      ...models.settings.init(),
      disablePaidFeatureAds: false,
    };

    const result = getMonkeyPatchedControlledSettings(settings);

    expect(result).toMatchObject({ disablePaidFeatureAds: true });
  });

  it('does not overwrite settings not controlled by the config', () => {
    getConfigSettings.mockReturnValue({});
    const settings = models.settings.init();

    const result = getMonkeyPatchedControlledSettings(settings);

    expect(result).toMatchObject(settings);
  });

  it('overwrites settings controlled by other settings', () => {
    getConfigSettings.mockReturnValue({});
    const settings: Settings = {
      ...models.settings.init(),
      incognitoMode: true,
      enableAnalytics: true,
    };

    const result = getMonkeyPatchedControlledSettings(settings);

    expect(result).toMatchObject({ enableAnalytics: false });
  });

  it('does not overwrite settings not controlled by other settings', () => {
    getConfigSettings.mockReturnValue({});
    const settings: Settings = {
      ...models.settings.init(),
      disablePaidFeatureAds: true,
    };

    const result = getMonkeyPatchedControlledSettings(settings);

    expect(result).toMatchObject({ disablePaidFeatureAds: true });
  });

  it('prioritizes config control over simple settings control', () => {
    getConfigSettings.mockReturnValue({ enableAnalytics: true });
    const settings: Settings = {
      ...models.settings.init(),
      incognitoMode: true,
      enableAnalytics: false,
    };

    const result = getMonkeyPatchedControlledSettings(settings);

    expect(result).toMatchObject({ enableAnalytics: true });
  });

  /** when the user settings say to do one thing [set enableAnalytics to false], but the config is saying something different [set enableAnalytics to true] but another value that is also in the config [incognitoMode] but which controls this setting [enableAnalytics] says to set it to a value [incognitoMode says to set enableAnalytics to false], then it's the controlling setting in the config that has final say on what the value is. Not the user settings, and not the literal value set in the config itself. */
  it('should prioritize controlling setting from config file above all other settings', () => {
    getConfigSettings.mockReturnValue({
      incognitoMode: true,
      enableAnalytics: true, // this intentionally conflicts with incognitoMode, which should force it to false
    });
    const settings: Settings = {
      ...models.settings.init(),
      incognitoMode: false, // this intentionally conflicts with the config
      enableAnalytics: false,
    };

    const result = getMonkeyPatchedControlledSettings(settings);

    expect(result).toMatchObject({
      incognitoMode: true,
      enableAnalytics: false,
    });
  });

  it('shows that enableAnalytics and allowNotificationRequests are false when incognitoMode is true in user settings', () => {
    getConfigSettings.mockReturnValue({});
    const settings: Settings = {
      ...models.settings.init(),
      incognitoMode: true,
      enableAnalytics: true,
      allowNotificationRequests: true,
    };

    const result = getMonkeyPatchedControlledSettings(settings);

    expect(result).toMatchObject({
      incognitoMode: true,
      enableAnalytics: false,
      allowNotificationRequests: false,
    });
  });

  it('shows that enableAnalytics and allowNotificationRequests are false when incognitoMode is true in the config', () => {
    getConfigSettings.mockReturnValue({
      incognitoMode: true,
    });
    const settings: Settings = {
      ...models.settings.init(),
      incognitoMode: false,
      enableAnalytics: true,
      allowNotificationRequests: true,
    };

    const result = getMonkeyPatchedControlledSettings(settings);

    expect(result).toMatchObject({
      incognitoMode: true,
      enableAnalytics: false,
      allowNotificationRequests: false,
    });
  });

  /**
   * This use-case test ensures that the likely config of a customer that has a security or privacy-centric configuration is preserved.
   */
  it('ensures a maximally privacy-centric use-case is preserved', () => {
    getConfigSettings.mockReturnValue({
      incognitoMode: true,
      disablePaidFeatureAds: true,
    });
    const settings = models.settings.init();

    const result = getMonkeyPatchedControlledSettings(settings);

    expect(result).toMatchObject({
      incognitoMode: true,
      enableAnalytics: false,
      allowNotificationRequests: false,
      disablePaidFeatureAds: true,
    });
  });
});
