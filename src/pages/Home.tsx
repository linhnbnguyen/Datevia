import React, { useEffect, useState, useMemo, useRef } from 'react';

import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Sparkles,
  Star,
  MapPin,
  ChevronRight,
  Compass,
  Map as MapIcon,
  Users,
  CalendarDays,
  Loader2,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { useTranslation } from '../hooks/useTranslation';
import type { RecommendedPlace } from '../types';
import { removeVietnameseTones } from '../utils';

const FONT_CHANGA = '"Changa One", cursive';
const FONT_DM_SANS = '"DM Sans", sans-serif';

// Show only 3–4 featured date spots on Home.
const FEATURED_LIMIT = 4;
const FEATURED_RADIUS_KM = 25;
const FEATURED_CACHE_PREFIX = 'datevia_featured_v5';

// Prevent auto-location from being called too frequently on every re-render.
const LOCATION_REFRESH_COOLDOWN_MS = 1000 * 60 * 10;
const LOCATION_REFRESH_STORAGE_KEY = 'datevia_last_home_location_refresh';

type OSMPlace = {
  place_id: number | string;
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    suburb?: string;
    city_district?: string;
    district?: string;
    province?: string;
    state?: string;
    county?: string;
    country?: string;
  };
};

type DateCategoryKey =
  | 'restaurant'
  | 'coffee'
  | 'park'
  | 'cinema'
  | 'entertainment'
  | 'shopping'
  | 'museum'
  | 'workshop'
  | 'live'
  | 'bar'
  | 'night_market'
  | 'tourist'
  | 'camping'
  | 'gaming'
  | 'sports';

interface DateCategoryConfig {
  queries: string[];
  keywords: string[];
}

const DATE_CATEGORY_CONFIGS: Record<DateCategoryKey, DateCategoryConfig> = {
  restaurant: {
    queries: ['romantic restaurant', 'restaurant', 'nha hang'],
    keywords: ['food', 'eat', 'dinner', 'lunch', 'restaurant', 'nha hang'],
  },
  coffee: {
    queries: ['cozy cafe', 'cafe', 'coffee'],
    keywords: ['coffee', 'cafe', 'ca phe', 'tea', 'drink', 'cozy'],
  },
  park: {
    queries: ['park', 'garden', 'cong vien'],
    keywords: ['park', 'nature', 'outdoor', 'walk', 'cong vien'],
  },
  cinema: {
    queries: ['cinema', 'movie theater', 'rap chieu phim'],
    keywords: ['movie', 'cinema', 'film', 'chieu phim'],
  },
  entertainment: {
    queries: ['entertainment center', 'amusement', 'vui choi'],
    keywords: ['fun', 'entertainment', 'play', 'vui choi'],
  },
  shopping: {
    queries: ['mall', 'shopping center', 'trung tam thuong mai'],
    keywords: ['mall', 'shopping', 'mua sam'],
  },
  museum: {
    queries: ['museum', 'art gallery', 'bao tang'],
    keywords: ['art', 'museum', 'culture', 'bao tang'],
  },
  workshop: {
    queries: ['workshop', 'creative class', 'hoc lam'],
    keywords: ['creative', 'learn', 'workshop', 'lop hoc'],
  },
  live: {
    queries: ['live music', 'concert', 'nhac song'],
    keywords: ['music', 'live', 'concert', 'nhac song'],
  },
  bar: {
    queries: ['cocktail bar', 'bar', 'pub'],
    keywords: ['drink', 'bar', 'pub', 'cocktail', 'night life'],
  },
  night_market: {
    queries: ['night market', 'cho dem'],
    keywords: ['market', 'night', 'street food', 'cho dem'],
  },
  tourist: {
    queries: ['attraction', 'landmark', 'diem tham quan'],
    keywords: ['landmark', 'view', 'tourist', 'canh dep'],
  },
  camping: {
    queries: ['camping', 'glamping', 'cam trai'],
    keywords: ['camping', 'glamping', 'nature', 'outdoor', 'cam trai'],
  },
  gaming: {
    queries: ['game center', 'arcade', 'esports'],
    keywords: ['gaming', 'esports', 'pc', 'chuyen game', 'arcade'],
  },
  sports: {
    queries: ['sports center', 'gym', 'the thao'],
    keywords: ['active', 'sports', 'gym', 'workout', 'the thao'],
  },
};

const DEFAULT_CATEGORY_PRIORITY: DateCategoryKey[] = [
  'restaurant',
  'coffee',
  'park',
  'entertainment',
  'cinema',
];

const normalizeText = (value: unknown) =>
  String(value || '')
    .toLowerCase()
    .trim();

const normalizePlaceKey = (value: unknown) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const stableHash = (value: unknown) => {
  const input = JSON.stringify(value || {});
  let hash = 0;

  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
};

const getDistanceKm = (from: [number, number], to: [number, number]) => {
  const [lng1, lat1] = from;
  const [lng2, lat2] = to;
  const earthRadiusKm = 6371;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  return earthRadiusKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const buildViewBox = (center: [number, number], radiusKm: number) => {
  const [lng, lat] = center;
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

  return {
    west: lng - lngDelta,
    east: lng + lngDelta,
    south: lat - latDelta,
    north: lat + latDelta,
  };
};

const NOMINATIM_MIRRORS = [
  'https://nominatim.openstreetmap.org',
  'https://nominatim.qwant.com',
  'https://nominatim.openstreetmap.de',
];

const getReadableLocationLabel = (
  location: Record<string, string | number> | null | undefined
): string => {
  if (!location) return 'Detect my location';

  const city =
    location.city ||
    location.town ||
    location.village ||
    location.province ||
    location.state ||
    location.country;

  const district =
    location.district ||
    location.city_district ||
    location.suburb ||
    location.county;

  const cityStr = city ? String(city) : '';
  const districtStr = district ? String(district) : '';

  if (
    districtStr &&
    cityStr &&
    normalizeText(districtStr) !== normalizeText(cityStr)
  ) {
    return `${districtStr}, ${cityStr}`;
  }

  return cityStr || 'Current location';
};

const dedupeRecommendedPlaces = (places: RecommendedPlace[]) => {
  const sortedPlaces = [...places].sort((a, b) => a.distanceKm - b.distanceKm);
  const uniquePlaces: RecommendedPlace[] = [];

  for (const place of sortedPlaces) {
    const placeNameKey = normalizePlaceKey(place.name);
    const placeAddressKey = normalizePlaceKey(place.address);

    const isDuplicate = uniquePlaces.some((existingPlace) => {
      const existingNameKey = normalizePlaceKey(existingPlace.name);
      const existingAddressKey = normalizePlaceKey(existingPlace.address);

      const sameName = existingNameKey === placeNameKey;
      const sameAddress = existingAddressKey === placeAddressKey;

      const veryClose =
        getDistanceKm(
          [existingPlace.lng, existingPlace.lat],
          [place.lng, place.lat]
        ) <= 0.08;

      const nameIncluded =
        existingNameKey.includes(placeNameKey) ||
        placeNameKey.includes(existingNameKey);

      return (
        (sameName && (sameAddress || veryClose)) ||
        (nameIncluded && veryClose)
      );
    });

    if (!isDuplicate) {
      uniquePlaces.push(place);
    }
  }

  return uniquePlaces;
};

const transformOSMToPlace = (
  osm: OSMPlace,
  center: [number, number],
  categoryLabel: string
): RecommendedPlace | null => {
  const lat = parseFloat(osm.lat);
  const lng = parseFloat(osm.lon);

  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

  const distanceKm = getDistanceKm(center, [lng, lat]);
  if (distanceKm > FEATURED_RADIUS_KM) return null;

  const name = osm.display_name.split(',')[0];
  const address = osm.display_name;

  const city =
    osm.address?.city ||
    osm.address?.town ||
    osm.address?.village ||
    osm.address?.province ||
    osm.address?.state ||
    osm.address?.country ||
    'Nearby';

  return {
    id: String(osm.place_id),
    name,
    address,
    city,
    lng,
    lat,
    category: categoryLabel,
    priceRange: '$$',
    rating: 4.5,
    image: `https://picsum.photos/seed/${osm.place_id}/900/700`,
    vibe: address,
    distanceKm,
    source: 'osm',
  };
};

const buildFeaturedCacheKey = ({
  userId,
  preferences,
  center,
}: {
  userId?: string;
  preferences: unknown;
  center?: [number, number] | null;
}) => {
  const preferenceHash = stableHash(preferences || {});
  const centerKey = center
    ? `${center[0].toFixed(3)}_${center[1].toFixed(3)}`
    : 'no_center';

  return `${FEATURED_CACHE_PREFIX}_${userId || 'guest'}_${preferenceHash}_${centerKey}`;
};

const getCachedFeaturedPlaces = (cacheKey: string): RecommendedPlace[] => {
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return [];

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed?.places)) return [];

    return dedupeRecommendedPlaces(parsed.places).slice(0, FEATURED_LIMIT);
  } catch {
    return [];
  }
};

const saveCachedFeaturedPlaces = (
  cacheKey: string,
  places: RecommendedPlace[]
) => {
  localStorage.setItem(
    cacheKey,
    JSON.stringify({
      places: dedupeRecommendedPlaces(places).slice(0, FEATURED_LIMIT),
      savedAt: Date.now(),
    })
  );
};

interface UserPreferences {
  dateType?: string;
  budgetRange?: string;
  purpose?: string;
  dietaryRestrictions?: string[];
}

const analyzeCoupleCentricCategories = (
  preferences: UserPreferences | null | undefined
): DateCategoryKey[] => {
  const pref = preferences || {};
  const preferenceText = normalizeText(
    [
      pref.dateType,
      pref.budgetRange,
      pref.purpose,
      ...(Array.isArray(pref.dietaryRestrictions)
        ? pref.dietaryRestrictions
        : []),
    ].join(' ')
  );

  const hasAnyPreference = preferenceText.trim().length > 0;

  const isOutdoor =
    preferenceText.includes('outdoor') ||
    preferenceText.includes('ngoai troi') ||
    preferenceText.includes('nature') ||
    preferenceText.includes('thien nhien') ||
    preferenceText.includes('walk') ||
    preferenceText.includes('walking') ||
    preferenceText.includes('picnic') ||
    preferenceText.includes('camping') ||
    preferenceText.includes('lake') ||
    preferenceText.includes('park');

  const isIndoor =
    preferenceText.includes('indoor') ||
    preferenceText.includes('trong nha') ||
    preferenceText.includes('mall') ||
    preferenceText.includes('cinema') ||
    preferenceText.includes('movie') ||
    preferenceText.includes('workshop');

  const isQuiet =
    preferenceText.includes('quiet') ||
    preferenceText.includes('calm') ||
    preferenceText.includes('chill') ||
    preferenceText.includes('yen tinh') ||
    preferenceText.includes('private') ||
    preferenceText.includes('cozy');

  const isLively =
    preferenceText.includes('lively') ||
    preferenceText.includes('fun') ||
    preferenceText.includes('party') ||
    preferenceText.includes('soi dong') ||
    preferenceText.includes('energetic') ||
    preferenceText.includes('active');

  const wantsFood =
    preferenceText.includes('food') ||
    preferenceText.includes('eat') ||
    preferenceText.includes('dinner') ||
    preferenceText.includes('lunch') ||
    preferenceText.includes('breakfast') ||
    preferenceText.includes('an uong') ||
    preferenceText.includes('nha hang') ||
    preferenceText.includes('restaurant');

  const wantsDrink =
    preferenceText.includes('coffee') ||
    preferenceText.includes('cafe') ||
    preferenceText.includes('ca phe') ||
    preferenceText.includes('milk tea') ||
    preferenceText.includes('tra sua') ||
    preferenceText.includes('dessert') ||
    preferenceText.includes('cake');

  const wantsNight =
    preferenceText.includes('night') ||
    preferenceText.includes('bar') ||
    preferenceText.includes('pub') ||
    preferenceText.includes('beer') ||
    preferenceText.includes('bia') ||
    preferenceText.includes('cocktail') ||
    preferenceText.includes('rooftop');

  const wantsCreative =
    preferenceText.includes('creative') ||
    preferenceText.includes('art') ||
    preferenceText.includes('workshop') ||
    preferenceText.includes('class') ||
    preferenceText.includes('pottery') ||
    preferenceText.includes('baking') ||
    preferenceText.includes('cooking') ||
    preferenceText.includes('museum') ||
    preferenceText.includes('exhibition');

  const wantsEntertainment =
    preferenceText.includes('game') ||
    preferenceText.includes('gaming') ||
    preferenceText.includes('karaoke') ||
    preferenceText.includes('bowling') ||
    preferenceText.includes('arcade') ||
    preferenceText.includes('billiards') ||
    preferenceText.includes('cinema') ||
    preferenceText.includes('movie') ||
    preferenceText.includes('phim');

  const wantsShopping =
    preferenceText.includes('shopping') ||
    preferenceText.includes('mua sam') ||
    preferenceText.includes('mall') ||
    preferenceText.includes('food court');

  const wantsActive =
    preferenceText.includes('sport') ||
    preferenceText.includes('active') ||
    preferenceText.includes('nang dong') ||
    preferenceText.includes('swimming') ||
    preferenceText.includes('climbing') ||
    preferenceText.includes('cycling') ||
    preferenceText.includes('paintball');

  const scoreMap = new Map<DateCategoryKey, number>();

  const addScore = (key: DateCategoryKey, score: number) => {
    scoreMap.set(key, (scoreMap.get(key) || 0) + score);
  };

  Object.entries(DATE_CATEGORY_CONFIGS).forEach(([key, config]) => {
    config.keywords.forEach((keyword) => {
      const normalizedKeyword = normalizeText(keyword);
      if (normalizedKeyword && preferenceText.includes(normalizedKeyword)) {
        addScore(key as DateCategoryKey, 4);
      }
    });
  });

  if (isOutdoor) {
    addScore('park', 8);
    addScore('tourist', 6);
    addScore('camping', 5);
    addScore('sports', 4);
    addScore('night_market', 3);
  }

  if (isIndoor) {
    addScore('cinema', 6);
    addScore('shopping', 5);
    addScore('entertainment', 5);
    addScore('workshop', 4);
  }

  if (isQuiet) {
    addScore('coffee', 6);
    addScore('park', 5);
    addScore('museum', 5);
    addScore('workshop', 4);
  }

  if (isLively) {
    addScore('entertainment', 7);
    addScore('bar', 6);
    addScore('night_market', 5);
    addScore('live', 5);
  }

  if (wantsFood) addScore('restaurant', 8);
  if (wantsDrink) addScore('coffee', 8);
  if (wantsNight) addScore('bar', 8);
  if (wantsCreative) {
    addScore('museum', 6);
    addScore('workshop', 6);
  }
  if (wantsEntertainment) addScore('entertainment', 8);
  if (wantsShopping) addScore('shopping', 8);
  if (wantsActive) addScore('sports', 8);

  const ranked = Array.from(scoreMap.entries())
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => key);

  if (ranked.length > 0) return ranked.slice(0, 4);
  if (!hasAnyPreference) return DEFAULT_CATEGORY_PRIORITY.slice(0, 4);

  return ['restaurant', 'coffee', 'park', 'cinema'];
};

const getCategoryLabel = (categoryKey: DateCategoryKey) => {
  const labels: Record<DateCategoryKey, string> = {
    restaurant: 'Dinner Date',
    coffee: 'Cafe Date',
    park: 'Outdoor Date',
    cinema: 'Movie Date',
    entertainment: 'Fun Date',
    shopping: 'Mall Date',
    museum: 'Culture Date',
    workshop: 'Creative Date',
    live: 'Live Music',
    bar: 'Night Date',
    night_market: 'Night Market',
    tourist: 'City Spot',
    camping: 'Outdoor Trip',
    gaming: 'Game Date',
    sports: 'Active Date',
  };

  return labels[categoryKey];
};

const fetchPlacesForCategory = async ({
  categoryKey,
  center,
}: {
  categoryKey: DateCategoryKey;
  center: [number, number];
}) => {
  const config = DATE_CATEGORY_CONFIGS[categoryKey];
  const categoryPlaces: RecommendedPlace[] = [];
  const viewBox = buildViewBox(center, FEATURED_RADIUS_KM);

  for (const query of config.queries.slice(0, 2)) {
    let results: OSMPlace[] = [];
    let success = false;

    for (const mirror of NOMINATIM_MIRRORS) {
      try {
        const response = await fetch(
          `${mirror}/search?q=${encodeURIComponent(
            query
          )}&format=json&addressdetails=1&limit=8&viewbox=${viewBox.west},${viewBox.south},${viewBox.east},${viewBox.north}&bounded=1`,
          { headers: { 'User-Agent': 'DateViaApp/1.0' } }
        );

        if (response.ok) {
          results = await response.json();
          success = true;
          break;
        }
      } catch (error) {
        console.warn(`OSM POI search mirror ${mirror} failed:`, error);
      }
    }

    if (success) {
      results.forEach((osm) => {
        const place = transformOSMToPlace(
          osm,
          center,
          getCategoryLabel(categoryKey)
        );
        if (place) categoryPlaces.push(place);
      });
    }
  }

  return dedupeRecommendedPlaces(categoryPlaces);
};

const fetchRecommendedPlaces = async ({
  center,
  preferences,
}: {
  center: [number, number];
  preferences: UserPreferences | null | undefined;
}) => {
  const selectedCategories = analyzeCoupleCentricCategories(
    preferences as UserPreferences
  );

  const categoryResults = await Promise.all(
    selectedCategories.map(async (categoryKey) => {
      const places = await fetchPlacesForCategory({
        categoryKey,
        center,
      });

      return {
        categoryKey,
        places,
      };
    })
  );

  const mixedPlaces: RecommendedPlace[] = [];

  // Mix one place from each matched category first, so Home feels personalized instead of repetitive.
  categoryResults.forEach(({ places }) => {
    if (places[0]) mixedPlaces.push(places[0]);
  });

  if (dedupeRecommendedPlaces(mixedPlaces).length < FEATURED_LIMIT) {
    categoryResults.forEach(({ places }) => {
      mixedPlaces.push(...places.slice(1));
    });
  }

  return dedupeRecommendedPlaces(mixedPlaces).slice(0, FEATURED_LIMIT);
};

const Home: React.FC = () => {
  const { user, plans, detectedLocation, refreshLocation, isLocationLoading } =
    useStore();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const carouselRef = useRef<HTMLDivElement>(null);

  const [greeting, setGreeting] = useState('');
  const [loadingFeaturedPlaces, setLoadingFeaturedPlaces] = useState(false);
  const [recommendedPlaces, setRecommendedPlaces] = useState<RecommendedPlace[]>(
    []
  );
  const [locationError, setLocationError] = useState<string | null>(null);

  const locationCenter = useMemo<[number, number] | null>(() => {
    if (!detectedLocation?.lng || !detectedLocation?.lat) return null;
    return [detectedLocation.lng, detectedLocation.lat];
  }, [detectedLocation]);

  const preferenceHash = useMemo(
    () => stableHash(user?.preferences || {}),
    [user?.preferences]
  );

  const featuredCacheKey = useMemo(
    () =>
      buildFeaturedCacheKey({
        userId: user?.uid || user?.email || 'guest',
        preferences: user?.preferences || {},
        center: locationCenter,
      }),
    [user?.uid, user?.email, preferenceHash, locationCenter]
  );

  const carouselPlaces = useMemo(() => {
    return dedupeRecommendedPlaces(recommendedPlaces).slice(0, FEATURED_LIMIT);
  }, [recommendedPlaces]);

  const locationLabel = useMemo(
    () => getReadableLocationLabel(detectedLocation),
    [detectedLocation]
  );

  useEffect(() => {
    const hour = new Date().getHours();

    if (hour < 12) setGreeting(t('home.greeting.morning'));
    else if (hour < 18) setGreeting(t('home.greeting.afternoon'));
    else setGreeting(t('home.greeting.evening'));
  }, [t]);

  // Auto-detect user location when Home opens.
  // This makes Featured Spots depend on each user's real location, not a static/default city.
  useEffect(() => {
    const shouldRefreshLocation = () => {
      if (typeof window === 'undefined') return false;
      if (!navigator.geolocation) {
        setLocationError('Location is not supported on this device.');
        return false;
      }

      const lastRefresh = Number(
        localStorage.getItem(LOCATION_REFRESH_STORAGE_KEY) || '0'
      );

      const isStale = Date.now() - lastRefresh > LOCATION_REFRESH_COOLDOWN_MS;
      return !detectedLocation || isStale;
    };

    if (!shouldRefreshLocation()) return;

    const runLocationRefresh = async () => {
      try {
        setLocationError(null);
        await refreshLocation();
        localStorage.setItem(LOCATION_REFRESH_STORAGE_KEY, String(Date.now()));
      } catch (error) {
        console.warn('Home location refresh failed:', error);
        setLocationError('Tap to enable location.');
      }
    };

    runLocationRefresh();
  }, [detectedLocation, refreshLocation]);

  useEffect(() => {
    if (!featuredCacheKey) return;

    const cached = getCachedFeaturedPlaces(featuredCacheKey);
    setRecommendedPlaces(cached);
  }, [featuredCacheKey]);

  useEffect(() => {
    if (!locationCenter) return;

    let cancelled = false;

    const loadFeaturedPlaces = async () => {
      setLoadingFeaturedPlaces(true);

      try {
        const places = await fetchRecommendedPlaces({
          center: locationCenter,
          preferences: user?.preferences || {},
        });

        if (cancelled) return;

        setRecommendedPlaces(places);
        saveCachedFeaturedPlaces(featuredCacheKey, places);
      } catch (error) {
        console.warn('Failed to load featured places:', error);
        if (!cancelled) setRecommendedPlaces([]);
      } finally {
        if (!cancelled) setLoadingFeaturedPlaces(false);
      }
    };

    loadFeaturedPlaces();

    return () => {
      cancelled = true;
    };
  }, [locationCenter, featuredCacheKey, preferenceHash, user?.preferences]);

  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel || carouselPlaces.length <= 1) return;

    const cardWidth = window.innerWidth < 640 ? 260 + 16 : 300 + 18;
    let currentIndex = 0;

    const intervalId = window.setInterval(() => {
      currentIndex += 1;
      if (currentIndex >= carouselPlaces.length) {
        currentIndex = 0;
      }

      carousel.scrollTo({
        left: currentIndex * cardWidth,
        behavior: 'smooth',
      });
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [carouselPlaces.length]);

  const handleManualLocationRefresh = async () => {
    try {
      setLocationError(null);
      await refreshLocation();
      localStorage.setItem(LOCATION_REFRESH_STORAGE_KEY, String(Date.now()));
    } catch (error) {
      console.warn('Manual location refresh failed:', error);
      setLocationError('Please allow location access.');
    }
  };

  const handleFeaturedPlaceClick = (place: RecommendedPlace) => {
    const query = `${place.name}, ${place.address}, ${place.lat}, ${place.lng}`;
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        query
      )}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  return (
    <div className="space-y-5 pb-20">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ fontFamily: FONT_CHANGA }}
            className="text-2xl tracking-tight leading-tight"
          >
            {greeting}, {user?.username ? `@${user.username}` : removeVietnameseTones(user?.displayName?.split(' ')[0] || 'there')}
          </motion.h1>

          <p className="text-[11px] text-text-muted font-medium">
            Ready for a new adventure?
          </p>
        </div>

        <button
          onClick={() => navigate('/profile')}
          className="w-10 h-10 rounded-full border-2 border-accent-orange/20 overflow-hidden"
        >
          <img
            src={
              user?.photoURL ||
              `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`
            }
            alt=""
            className="w-full h-full object-cover"
          />
        </button>
      </header>

      {/* Compact Navigation Buttons */}
      <section className="grid grid-cols-4 gap-2 sm:gap-3">
        {[
          {
            label: 'Discover',
            icon: Compass,
            path: '/discover',
            color: 'bg-accent-orange/10 text-accent-orange',
          },
          {
            label: 'Map',
            icon: MapIcon,
            path: '/map',
            color: 'bg-accent-mint/10 text-accent-mint',
          },
          {
            label: 'Planner',
            icon: CalendarDays,
            path: '/planner',
            color: 'bg-accent-pink/10 text-accent-pink',
          },
          {
            label: 'Community',
            icon: Users,
            path: '/community',
            color: 'text-accent-blue',
            hasSpecialIconBorder: true,
          },
        ].map((item, idx) => (
          <motion.button
            key={item.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.04 }}
            onClick={() => navigate(item.path)}
            className={`glass min-h-[74px] sm:min-h-[86px] px-2 py-3 flex flex-col items-center justify-center gap-2 rounded-2xl border transition-all group relative overflow-hidden ${
              item.hasSpecialIconBorder
                ? 'border-transparent'
                : 'border-black/5 dark:border-white/10'
            } hover:scale-[1.03] active:scale-95`}
          >
            <div
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${
                item.color || ''
              } ${
                item.hasSpecialIconBorder
                  ? 'border-[3px] border-accent-blue bg-white dark:bg-black/20'
                  : ''
              }`}
            >
              <item.icon className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>

            <span
              style={{ fontFamily: FONT_DM_SANS }}
              className="text-[10px] sm:text-[11px] font-extrabold leading-none tracking-tight text-text/80"
            >
              {item.label}
            </span>
          </motion.button>
        ))}
      </section>

      {/* Featured Spots Section */}
      <section className="space-y-3 pt-1">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h2
              style={{ fontFamily: FONT_CHANGA }}
              className="text-2xl tracking-tight leading-tight"
            >
              {t('home.featuredTitle')}
            </h2>

            <p className="text-[11px] text-text-muted font-medium">
              3–4 spots matched with your city and couple vibe.
            </p>
          </div>

          <button
            type="button"
            onClick={handleManualLocationRefresh}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent-orange/10 border border-accent-orange/20 hover:bg-accent-orange/20 transition-all max-w-[170px]"
          >
            {isLocationLoading ? (
              <Loader2 className="w-3 h-3 text-accent-orange animate-spin" />
            ) : (
              <MapPin className="w-3 h-3 text-accent-orange" />
            )}

            <span
              style={{ fontFamily: FONT_DM_SANS }}
              className="text-[9px] font-bold text-accent-orange uppercase tracking-widest truncate"
            >
              {isLocationLoading
                ? 'Detecting...'
                : removeVietnameseTones(locationError || locationLabel)}
            </span>
          </button>
        </div>

        <div
          ref={carouselRef}
          className="flex gap-4 sm:gap-5 overflow-x-auto pb-6 custom-scrollbar scroll-smooth snap-x snap-mandatory"
        >
          {loadingFeaturedPlaces ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="min-w-[260px] sm:min-w-[300px] h-[360px] sm:h-[420px] rounded-[30px] sm:rounded-[38px] bg-black/5 dark:bg-white/5 animate-pulse"
              />
            ))
          ) : carouselPlaces.length > 0 ? (
            carouselPlaces.map((place) => (
              <motion.div
                key={place.id}
                onClick={() => handleFeaturedPlaceClick(place)}
                className="min-w-[260px] sm:min-w-[300px] h-[360px] sm:h-[420px] group/card cursor-pointer snap-start relative"
              >
                <div className="w-full h-full glass rounded-[30px] sm:rounded-[38px] overflow-hidden relative shadow-xl border border-white/20">
                  <div className="absolute inset-0">
                    <img
                      src={place.image || undefined}
                      alt={place.name}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover/card:scale-110"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  </div>

                  <div className="absolute top-5 right-5 glass px-3 py-1 rounded-full flex items-center gap-1 text-xs font-bold text-white">
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    {place.rating.toFixed(1)}
                  </div>

                  <div className="absolute bottom-6 left-6 right-6 space-y-3">
                    <div className="space-y-1">
                      <span className="inline-block px-2 py-0.5 rounded-full bg-accent-orange text-[8px] font-bold text-white uppercase tracking-widest">
                        {place.category}
                      </span>

                      <h3
                        style={{ fontFamily: FONT_CHANGA }}
                        className="text-2xl text-white tracking-tight line-clamp-2"
                      >
                        {removeVietnameseTones(place.name)}
                      </h3>

                      <p className="text-white/60 text-xs line-clamp-1 italic">
                        {place.address}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/10">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold text-sm">
                          {place.priceRange}
                        </span>
                        <div className="w-1 h-1 rounded-full bg-white/30" />
                        <span className="text-white/60 text-[10px] font-medium uppercase tracking-widest">
                          {place.distanceKm.toFixed(1)} km
                        </span>
                      </div>

                      <ChevronRight className="w-5 h-5 text-white/50 group-hover/card:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="w-full py-16 text-center glass rounded-[36px] px-6">
              <p className="text-text-muted font-medium">
                No places found near your current location.
              </p>

              <button
                type="button"
                onClick={handleManualLocationRefresh}
                className="mt-4 px-5 py-2 rounded-full bg-accent-orange/10 text-accent-orange text-xs font-bold uppercase tracking-widest"
              >
                Detect again
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Upcoming Events Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2
            style={{ fontFamily: FONT_CHANGA }}
            className="text-2xl tracking-tight leading-tight"
          >
            Upcoming Events
          </h2>

          {plans.length > 0 && (
            <button
              onClick={() => navigate('/planner')}
              className="text-xs font-extrabold uppercase tracking-widest text-accent-orange hover:text-accent-orange/80 transition-colors"
            >
              View All
            </button>
          )}
        </div>

        {plans.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {plans.slice(0, 3).map((plan) => (
              <motion.div
                key={plan.id}
                whileHover={{ y: -5 }}
                className="glass p-5 rounded-[28px] flex items-center gap-4 group cursor-pointer"
                onClick={() => navigate('/planner')}
              >
                <div className="w-14 h-14 rounded-2xl bg-accent-orange/10 flex items-center justify-center shrink-0 group-hover:bg-accent-orange/20 transition-colors">
                  <Sparkles className="w-5 h-5 text-accent-orange" />
                </div>

                <div className="flex-1 min-w-0">
                  <h4
                    className="font-bold text-base truncate"
                    style={{ fontFamily: FONT_CHANGA }}
                  >
                    {removeVietnameseTones(plan.placeName)}
                  </h4>

                  <p className="text-xs text-text-muted flex items-center gap-2">
                    <span className="font-bold text-accent-orange">
                      {plan.date}
                    </span>
                    <span>•</span>
                    <span>{plan.time}</span>
                  </p>
                </div>

                <ChevronRight className="w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="glass p-8 rounded-[32px] flex flex-col items-center justify-center text-center gap-5 border border-white/10 bg-white/5">
            <div className="space-y-2">
              <p className="text-text-muted font-medium">
                No upcoming date plans yet.
              </p>

              <p className="text-sm text-text-muted/60 max-w-xs mx-auto">
                Ready for something special? Start building your perfect date plan
                in the Planner.
              </p>
            </div>

            <button
              onClick={() => navigate('/planner')}
              className="px-6 py-2.5 bg-white/5 border border-white/10 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-colors"
            >
              Go to Planner
            </button>
          </div>
        )}
      </section>

      {/* AI Analyzer Highlight Card */}
      <motion.section
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4 }}
        className="glass p-5 md:p-6 rounded-[32px] border border-white/20 flex flex-col md:flex-row items-center gap-4 md:gap-5 shadow-lg cursor-pointer hover:scale-[1.01] transition-transform group"
        onClick={() => navigate('/discover')}
      >
        <div className="w-14 h-14 md:w-16 md:h-16 rounded-[24px] bg-gradient-to-br from-[#FFA1DD] to-[#C3B1E1] flex items-center justify-center text-white shadow-md shadow-[#FFA1DD]/20 shrink-0 group-hover:rotate-6 transition-transform duration-500">
          <Sparkles className="w-7 h-7 md:w-8 md:h-8" />
        </div>

        <div className="flex-1 space-y-2 text-center md:text-left">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-orange/10 text-[9px] font-bold text-accent-orange uppercase tracking-widest">
            AI Powered
          </div>

          <h2
            style={{ fontFamily: FONT_CHANGA }}
            className="text-2xl md:text-3xl tracking-tight leading-tight"
          >
            Try AI Analyzer
          </h2>

          <p
            style={{ fontFamily: FONT_DM_SANS }}
            className="text-text-muted text-sm md:text-base max-w-xl"
          >
            Uncover the perfect date vibe and personalize your experiences with
            our intelligent analyzer.
          </p>
        </div>

        <div className="hidden md:flex w-9 h-9 glass rounded-full items-center justify-center bg-white/10 border border-white/20 group-hover:translate-x-1 transition-transform">
          <ChevronRight className="w-5 h-5 text-text-muted" />
        </div>
      </motion.section>
    </div>
  );
};

export default Home;