import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { UserStats } from '../types/User';

const APP_NOTIFICATION_MARKER = 'hot-or-not-takes';
const REMINDER_CHANNEL_ID = 'gameplay-reminders';
const MILESTONE_CHANNEL_ID = 'gameplay-milestones';
const PERMISSION_ASKED_KEY = 'notifications_permission_asked:v1';
const SCHEDULED_NOTIFICATION_KEY_PREFIX = 'scheduled-notification:v1';
const QUEST_REMINDER_HOUR = 19;
const STREAK_REMINDER_HOUR = 20;

type NotificationKind = 'quest-reminder' | 'streak-reminder' | 'streak-milestone';

type HotOrNotNotificationData = {
  app?: string;
  type?: NotificationKind;
  userId?: string;
  date?: string;
  milestone?: number;
};

const NOTIFICATION_STREAK_MILESTONES = new Set([7, 14, 30, 60]);

let handlerConfigured = false;
let channelSetupPromise: Promise<void> | null = null;

const getLocalDateKey = (date: Date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getStableIndex = (seed: string, modulo: number) => {
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return modulo > 0 ? hash % modulo : 0;
};

const isPermissionGranted = (settings: Notifications.NotificationPermissionsStatus) =>
  settings.granted ||
  settings.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED ||
  settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
  settings.ios?.status === Notifications.IosAuthorizationStatus.EPHEMERAL;

const getReminderStorageKey = (
  userId: string,
  dateKey: string,
  type: Extract<NotificationKind, 'quest-reminder' | 'streak-reminder'>
) => `${SCHEDULED_NOTIFICATION_KEY_PREFIX}:${userId}:${dateKey}:${type}`;

const getMilestoneStorageKey = (userId: string, milestone: number, dateKey: string) =>
  `${SCHEDULED_NOTIFICATION_KEY_PREFIX}:${userId}:${dateKey}:streak-milestone:${milestone}`;

const getTargetDateToday = (hour: number, minute = 0): Date | null => {
  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);

  return target.getTime() > now.getTime() ? target : null;
};

const getQuestReminderCopy = (stats: UserStats, seed: string) => {
  const challenge = stats.dailyChallenge;
  const remaining = Math.max(0, challenge.goal - challenge.progress);
  const title = challenge.title || "today's quest";
  const variants = [
    {
      title: '🎯 Quest waiting!',
      body: `${remaining} vote${remaining === 1 ? '' : 's'} left on ${title}.`,
    },
    {
      title: '🎯 Almost there!',
      body: `${title} is still on the table.`,
    },
    {
      title: '🎯 Quest check!',
      body: "You're closer than you think.",
    },
  ];

  return variants[getStableIndex(seed, variants.length)];
};

const getStreakReminderCopy = (stats: UserStats, seed: string) => {
  const variants = [
    {
      title: '🔥 Streak on the line!',
      body: `One vote saves day ${stats.votingStreak + 1}.`,
    },
    {
      title: `🔥 Day ${stats.votingStreak + 1} is waiting!`,
      body: 'One vote gets it done.',
    },
    {
      title: "🔥 Don't drop the run!",
      body: `Your ${stats.votingStreak}-day streak needs one vote.`,
    },
  ];

  return variants[getStableIndex(seed, variants.length)];
};

const getMilestoneCopy = (milestone: number) => {
  switch (milestone) {
    case 7:
      return {
        title: '🔥 7-day streak!',
        body: "A full week. That's real.",
      };
    case 14:
      return {
        title: '🔥 14-day streak!',
        body: "Two weeks. You're locked in.",
      };
    case 30:
      return {
        title: '🏆 30-day streak!',
        body: 'A full month. Legendary.',
      };
    case 60:
      return {
        title: '🏆 60-day streak!',
        body: 'Two months. Ridiculous in the best way.',
      };
    default:
      return {
        title: `🔥 ${milestone}-day streak!`,
        body: 'Milestone unlocked.',
      };
  }
};

export const configureNotificationChannels = async () => {
  if (Platform.OS !== 'android') {
    return;
  }

  if (!channelSetupPromise) {
    channelSetupPromise = (async () => {
      await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
        name: 'Gameplay Reminders',
        description: 'Daily quest and streak reminders.',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        enableVibrate: false,
        showBadge: false,
      });

      await Notifications.setNotificationChannelAsync(MILESTONE_CHANNEL_ID, {
        name: 'Milestones',
        description: 'Streak milestone celebrations.',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
        enableVibrate: false,
        showBadge: false,
      });
    })().catch(error => {
      channelSetupPromise = null;
      throw error;
    });
  }

  return channelSetupPromise;
};

export const setupNotifications = () => {
  if (handlerConfigured) {
    return;
  }

  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data as HotOrNotNotificationData;
      const isMilestone = data.app === APP_NOTIFICATION_MARKER && data.type === 'streak-milestone';

      return {
        shouldShowBanner: isMilestone,
        shouldShowList: isMilestone,
        shouldPlaySound: isMilestone,
        shouldSetBadge: false,
      };
    },
  });

  configureNotificationChannels().catch(error => {
    console.warn('Unable to configure notification channels:', error);
  });
};

export const hasNotificationPermission = async () => {
  const settings = await Notifications.getPermissionsAsync();
  return isPermissionGranted(settings);
};

export const requestNotificationsAfterQuestCompletion = async () => {
  const alreadyAsked = await AsyncStorage.getItem(PERMISSION_ASKED_KEY);
  if (alreadyAsked === 'true') {
    return hasNotificationPermission();
  }

  await configureNotificationChannels();

  const existingSettings = await Notifications.getPermissionsAsync();
  if (isPermissionGranted(existingSettings)) {
    await AsyncStorage.setItem(PERMISSION_ASKED_KEY, 'true');
    return true;
  }

  await AsyncStorage.setItem(PERMISSION_ASKED_KEY, 'true');
  const settings = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true,
    },
    android: {},
  });

  return isPermissionGranted(settings);
};

const cancelStoredNotification = async (storageKey: string) => {
  const identifier = await AsyncStorage.getItem(storageKey);
  if (!identifier) {
    return;
  }

  await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});
  await AsyncStorage.removeItem(storageKey);
};

const cancelOutdatedHotOrNotNotifications = async (userId: string, todayKey: string) => {
  const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);

  await Promise.all(
    scheduledNotifications.map(async (notification) => {
      const data = notification.content.data as HotOrNotNotificationData;
      if (
        data.app === APP_NOTIFICATION_MARKER &&
        data.userId === userId &&
        data.date &&
        data.date !== todayKey
      ) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier).catch(() => {});
      }
    })
  );
};

const scheduleOrCancelReminder = async ({
  userId,
  dateKey,
  type,
  shouldSchedule,
  targetDate,
  content,
}: {
  userId: string;
  dateKey: string;
  type: Extract<NotificationKind, 'quest-reminder' | 'streak-reminder'>;
  shouldSchedule: boolean;
  targetDate: Date | null;
  content: { title: string; body: string };
}) => {
  const storageKey = getReminderStorageKey(userId, dateKey, type);

  if (!shouldSchedule || !targetDate) {
    await cancelStoredNotification(storageKey);
    return;
  }

  const existingIdentifier = await AsyncStorage.getItem(storageKey);
  if (existingIdentifier) {
    return;
  }

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: content.title,
      body: content.body,
      sound: true,
      data: {
        app: APP_NOTIFICATION_MARKER,
        type,
        userId,
        date: dateKey,
      } satisfies HotOrNotNotificationData,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: targetDate,
      channelId: REMINDER_CHANNEL_ID,
    },
  });

  await AsyncStorage.setItem(storageKey, identifier);
};

export const syncDailyReminderNotifications = async (userId: string, stats: UserStats) => {
  await configureNotificationChannels();

  const todayKey = getLocalDateKey();
  const hasPermission = await hasNotificationPermission();

  await cancelOutdatedHotOrNotNotifications(userId, todayKey);

  if (!hasPermission) {
    await Promise.all([
      cancelStoredNotification(getReminderStorageKey(userId, todayKey, 'quest-reminder')),
      cancelStoredNotification(getReminderStorageKey(userId, todayKey, 'streak-reminder')),
    ]);
    return;
  }

  const challenge = stats.dailyChallenge;
  const challengeIsToday = challenge.date === todayKey;
  const questTarget = getTargetDateToday(QUEST_REMINDER_HOUR);
  const streakTarget = getTargetDateToday(STREAK_REMINDER_HOUR);

  await Promise.all([
    scheduleOrCancelReminder({
      userId,
      dateKey: todayKey,
      type: 'quest-reminder',
      shouldSchedule: challengeIsToday && !challenge.completed && challenge.progress < challenge.goal,
      targetDate: questTarget,
      content: getQuestReminderCopy(stats, `${userId}:${todayKey}:quest-reminder`),
    }),
    scheduleOrCancelReminder({
      userId,
      dateKey: todayKey,
      type: 'streak-reminder',
      shouldSchedule: stats.votingStreak >= 2 && !stats.streakUpdatedToday,
      targetDate: streakTarget,
      content: getStreakReminderCopy(stats, `${userId}:${todayKey}:streak-reminder`),
    }),
  ]);
};

export const scheduleStreakMilestoneNotification = async (userId: string, milestone: number) => {
  if (!NOTIFICATION_STREAK_MILESTONES.has(milestone)) {
    return;
  }

  if (!(await hasNotificationPermission())) {
    return;
  }

  await configureNotificationChannels();

  const todayKey = getLocalDateKey();
  const storageKey = getMilestoneStorageKey(userId, milestone, todayKey);
  const alreadyScheduled = await AsyncStorage.getItem(storageKey);
  if (alreadyScheduled) {
    return;
  }

  const content = getMilestoneCopy(milestone);
  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: content.title,
      body: content.body,
      sound: true,
      data: {
        app: APP_NOTIFICATION_MARKER,
        type: 'streak-milestone',
        userId,
        date: todayKey,
        milestone,
      } satisfies HotOrNotNotificationData,
    },
    trigger: {
      channelId: MILESTONE_CHANNEL_ID,
    },
  });

  await AsyncStorage.setItem(storageKey, identifier);
};
