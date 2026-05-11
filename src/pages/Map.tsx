import React, { useEffect, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  MapContainer, 
  TileLayer, 
  Marker, 
  Popup, 
  Polyline, 
  useMap, 
  useMapEvents 
} from "react-leaflet";
import { useLocation, useNavigate } from "react-router-dom";
import L from "leaflet";
import {
  X,
  Plus,
  MapPin,
  Search,
  Check,
  ChevronDown,
  Filter as FilterIcon,
  Trash2,
  Clock,
  Coins,
  Star,
  Upload,
  Edit2,
  Save,
  MoreVertical,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { subscribeToSharedSpots, addSharedSpot, deleteSharedSpot, updateSharedSpot, handleFirestoreError, OperationType } from "../services/firestore";
import { compressImage, removeVietnameseTones } from "../lib/utils";
import { CommunityPost } from "../types";

import { useStore } from "../store/useStore";
import { useTranslation } from "../hooks/useTranslation";

import BeerIcon from "../assets/Beer.png";
import DonutIcon from "../assets/Donut.png";
import HamburgerIcon from "../assets/Hamburger.png";
import PhoIcon from "../assets/Pho.png";
import SushiIcon from "../assets/Sushi.png";
import WeatherIcon from "../assets/weather.png";
import YourHomeIcon from "../assets/yourhomeicon.png";

// Fix for default marker icons in Leaflet
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

type LngLat = [number, number];

interface ReviewRecord {
  id: string;
  name: string;
  rating: number;
  text: string;
  foodRating?: number;
  serviceRating?: number;
  atmosphereRating?: number;
  media?: string[];
  createdAt: number;
}

interface Spot {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  image: string;
  category: string;
  city?: string;
  district?: string;
  images?: string[];
  rating?: number;
  openingHour?: string;
  closingHour?: string;
  priceRange?: string;
  priceAmount?: string;
  userId?: string;
  createdBy?: string;
  icon?: string;
  review?: string;
  reviewName?: string;
  foodRating?: number;
  serviceRating?: number;
  atmosphereRating?: number;
  reviewMedia?: string[];
  reviews?: ReviewRecord[];
  menu?: string[];
}

const formatDate = (date: unknown) => {
  if (!date) return "";
  let d: Date;
  if (date instanceof Date) {
    d = date;
  } else if (typeof date === 'object' && date !== null && 'toDate' in date) {
    const ts = date as { toDate: () => Date };
    d = ts.toDate();
  } else if (typeof date === 'string' || typeof date === 'number') {
    d = new Date(date);
  } else {
    return "";
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const toBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });

const DEFAULT_CENTER: LngLat = [10.7765, 106.703]; // HCMC
const FONT_CHANGA = '"Changa One", cursive';
const FONT_DM_SANS = '"DM Sans", sans-serif';

const NOMINATIM_MIRRORS = [
  "https://nominatim.openstreetmap.de",
  "https://nominatim.qwant.com",
  "https://nominatim.phi-stiftung.de",
  "https://nominatim.openstreetmap.org",
];
const OSRM_BASE = "https://router.project-osrm.org";

const MAIN_CATEGORIES = ["Coffee & Brunch", "Dining", "Nightlife", "Activities", "Shopping"];
const ALL_ICONS = [PhoIcon, SushiIcon, HamburgerIcon, BeerIcon, DonutIcon];

const CATEGORY_ICON_MAP: Record<string, string> = {
  "Coffee & Brunch": DonutIcon,
  "Dining": PhoIcon,
  "Nightlife": BeerIcon,
  "Activities": HamburgerIcon,
  "Shopping": SushiIcon,
};

const CATEGORIES = MAIN_CATEGORIES; // Use only main categories as per request

const CITY_DISTRICTS: Record<string, string[]> = {
  "Ho Chi Minh City": ["District 1", "District 2", "District 3", "District 4", "District 5", "District 6", "District 7", "District 8", "District 9", "District 10", "District 11", "District 12", "Binh Thanh", "Phu Nhuan", "Go Vap", "Tan Binh", "Tan Phu", "Binh Tan", "Thu Duc", "Hoc Mon", "Cu Chi", "Binh Chanh", "Nha Be", "Can Gio"],
  "Hanoi": ["Ba Dinh", "Hoan Kiem", "Tay Ho", "Long Bien", "Cau Giay", "Dong Da", "Hai Ba Trung", "Hoang Mai", "Thanh Xuan", "Nam Tu Liem", "Bac Tu Liem", "Ha Dong", "Son Tay"],
  "Da Nang": ["Hai Chau", "Thanh Khe", "Son Tra", "Ngu Hanh Son", "Lien Chieu", "Cam Le", "Hoa Vang"]
};

const MapController: React.FC<{
  center: LngLat | null,
  onMapClick: (latlng: L.LatLng) => void,
  onBackgroundClick: () => void,
  onMoveEnd?: (center: L.LatLng) => void,
  isCaptureMode?: boolean
}> = ({ center, onMapClick, onBackgroundClick, onMoveEnd, isCaptureMode }) => {
  const map = useMap();

  useEffect(() => {
    if (center && !isNaN(center[0]) && !isNaN(center[1])) {
      try {
        const currentCenter = map.getCenter();
        // Only fly if the difference is significant to avoid infinite loops or jitter
        const latDiff = Math.abs(currentCenter.lat - center[0]);
        const lngDiff = Math.abs(currentCenter.lng - center[1]);
        
        if (latDiff > 0.0001 || lngDiff > 0.0001) {
          map.flyTo(center as L.LatLngExpression, 15, { animate: true, duration: 1.5 });
        }
      } catch (err) {
        console.warn("Map flyTo failed:", err);
      }
    }
  }, [center, map]);

  useMapEvents({
    click(e) {
      if (isCaptureMode) {
        onMapClick(e.latlng);
      } else {
        onBackgroundClick();
      }
    },
    dblclick(e) {
      onMapClick(e.latlng);
    },
    moveend() {
      if (onMoveEnd) {
        onMoveEnd(map.getCenter());
      }
    }
  });

  return null;
};

const SpotMarker: React.FC<{
  spot: Spot;
  isSelected: boolean;
  onSelect: (spot: Spot) => void;
}> = ({ spot, isSelected, onSelect }) => {
  const iconUrl = CATEGORY_ICON_MAP[spot.category] || spot.icon || ALL_ICONS[0];

  const spotIcon = useMemo(() => L.divIcon({
    className: "custom-div-icon",
    html: `
      <div class="spot-marker-icon ${isSelected ? 'spot-marker-selected' : ''}">
        <img
          src="${iconUrl}"
          alt=""
        />
      </div>
    `,
    iconSize: [42, 42],
    iconAnchor: [21, 42],
    popupAnchor: [0, -42]
  }), [iconUrl, isSelected]);

  return (
    <Marker
      key={spot.id}
      position={[spot.lat, spot.lng]}
      icon={spotIcon}
      eventHandlers={{
        click: () => onSelect(spot)
      }}
      zIndexOffset={isSelected ? 1000 : 0}
    />
  );
};

const DeleteConfirmationModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
  spotName: string;
}> = ({ isOpen, onClose, onConfirm, isLoading, spotName }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-sm bg-white dark:bg-neutral-900 rounded-[32px] p-8 shadow-2xl border border-white/10"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-bold mb-2 dark:text-white" style={{ fontFamily: FONT_CHANGA }}>Delete This Spot?</h3>
              <p className="text-sm text-text-muted mb-8 leading-relaxed">
                Are you sure you want to remove <span className="text-text-main dark:text-white font-bold">"{spotName}"</span>? This action is permanent and cannot be undone.
              </p>
              
              <div className="flex flex-col w-full gap-3">
                <button
                  disabled={isLoading}
                  onClick={onConfirm}
                  className="w-full py-4 bg-red-500 text-white rounded-2xl font-bold uppercase tracking-widest hover:bg-red-600 active:scale-[0.98] transition-all disabled:opacity-50"
                  style={{ fontFamily: FONT_CHANGA }}
                >
                  {isLoading ? "Deleting..." : "Yes, Delete It"}
                </button>
                <button
                  disabled={isLoading}
                  onClick={onClose}
                  className="w-full py-4 bg-black/5 dark:bg-white/5 text-text-main dark:text-white rounded-2xl font-bold uppercase tracking-widest hover:bg-black/10 transition-all"
                  style={{ fontFamily: FONT_CHANGA }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export const MapPage: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { 
    user, 
    detectedLocation,
    refreshLocation,
    partnerId
  } = useStore();

  const [userLocation, setUserLocation] = useState<LngLat | null>(null);
  const [hasCentered, setHasCentered] = useState(false);
  const [spots, setSpots] = useState<Spot[]>([]);

  // Sync with store location
  useEffect(() => {
    if (!detectedLocation) {
      refreshLocation();
      return;
    }
    
    if (detectedLocation && !isNaN(detectedLocation.lat) && !isNaN(detectedLocation.lng)) {
      const loc: LngLat = [detectedLocation.lat, detectedLocation.lng];
      setUserLocation(loc);
      setDetectedCity(detectedLocation.city);
      
      if (!hasCentered) {
        safeSetFlyToCoords(loc);
        setHasCentered(true);
      }
    }
  }, [detectedLocation, hasCentered, refreshLocation]);

  useEffect(() => {
    console.log("[DEBUG] Subscribing to shared spots...");
    const unsub = subscribeToSharedSpots((data) => {
      console.log("[DEBUG] Real-time spots update. RAW Count:", data.length);
      const validSpots = (data as Spot[]).filter(s => {
        const anySpot = s as unknown as { latitude?: number; lon?: number; longitude?: number; lat?: number; lng?: number };
        const latValue = s.lat !== undefined ? s.lat : anySpot.latitude;
        const lngValue = s.lng !== undefined ? s.lng : (anySpot.lon || anySpot.longitude);
        
        const lat = typeof latValue === 'number' ? latValue : parseFloat(String(latValue));
        const lng = typeof lngValue === 'number' ? lngValue : parseFloat(String(lngValue));
        return s && !isNaN(lat) && !isNaN(lng);
      }).map(s => {
        const anySpot = s as unknown as { latitude?: number; lon?: number; longitude?: number; lat?: number; lng?: number };
        const latValue = s.lat !== undefined ? s.lat : anySpot.latitude;
        const lngValue = s.lng !== undefined ? s.lng : (anySpot.lon || anySpot.longitude);
        
        return {
          ...s,
          lat: typeof latValue === 'number' ? latValue : parseFloat(String(latValue)),
          lng: typeof lngValue === 'number' ? lngValue : parseFloat(String(lngValue))
        };
      });
      console.log("[DEBUG] Valid spots count:", validSpots.length);
      setSpots(validSpots);
    });
    return () => unsub();
  }, []);

  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [panelLayer, setPanelLayer] = useState<number>(1); // 1: Overview, 0: Rating Post, 2: Menu
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [isAddingReview, setIsAddingReview] = useState(false);
  const [newReviewText, setNewReviewText] = useState("");
  const [newReviewName, setNewReviewName] = useState("");
  const [newReviewRating, setNewReviewRating] = useState(5);
  const [newReviewFoodRating, setNewReviewFoodRating] = useState<number | null>(null);
  const [newReviewServiceRating, setNewReviewServiceRating] = useState<number | null>(null);
  const [newReviewAtmosphereRating, setNewReviewAtmosphereRating] = useState<number | null>(null);
  const [newReviewMedia, setNewReviewMedia] = useState<string[]>([]);

  useEffect(() => {
    setPanelLayer(1); // Default to Overview tab
    if (selectedSpot) {
      setEditedName(selectedSpot.name);
      setIsEditingName(false);
      setIsAddingReview(false);
    }
  }, [selectedSpot]);

  const [detailViewMode, setDetailViewMode] = useState<"popup" | "panel" | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isHidingModalForPin, setIsHidingModalForPin] = useState(false);
  const [isPickingFromMap, setIsPickingFromMap] = useState(false);
  const [newSpotCoords, setNewSpotCoords] = useState<LngLat | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [flyToCoords, setFlyToCoords] = useState<LngLat | null>(null);

  const safeSetFlyToCoords = (coords: LngLat | null) => {
    if (coords && !isNaN(coords[0]) && !isNaN(coords[1])) {
      setFlyToCoords(coords);
    }
  };

  const [selectedCategory, setSelectedCategory] = useState("Everywhere");
  const [selectedDistrict, setSelectedDistrict] = useState("All Districts");
  const [catSearchQuery, setCatSearchQuery] = useState("");
  const [isCatDropdownOpen, setIsCatDropdownOpen] = useState(false);
  const [isDistDropdownOpen, setIsDistDropdownOpen] = useState(false);
  const [detectedCity, setDetectedCity] = useState("Ho Chi Minh City");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [geocodingStatus, setGeocodingStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const [isWeatherOpen, setIsWeatherOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [spotToDelete, setSpotToDelete] = useState<Spot | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [communityReviews, setCommunityReviews] = useState<CommunityPost[]>([]);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [reviewToDelete, setReviewToDelete] = useState<{ spotId: string, reviewId: string, isCommunity?: boolean } | null>(null);

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const isAdmin = user?.email && ['nblinh465@gmail.com', 'linhbao456nguyen@gmail.com'].includes(user.email);

  useEffect(() => {
    if (selectedSpot) {
      const q = query(
        collection(db, 'communityPosts'),
        where('linkedSpotId', '==', selectedSpot.id),
        orderBy('timestamp', 'desc')
      );
      const unsub = onSnapshot(q, (snapshot) => {
        const userId = user?.uid;
        const allPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as CommunityPost);
        const filtered = allPosts.filter(post => {
          if (post.visibility === 'public') return true;
          if (post.userId === userId) return true;
          if (post.visibility === 'partner' && partnerId && post.userId === partnerId) return true;
          return false;
        });
        setCommunityReviews(filtered);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'communityPosts');
      });
      return () => unsub();
    } else {
      setCommunityReviews([]);
    }
  }, [selectedSpot, user, partnerId]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const spotId = params.get('spotId');
    
    if (spotId && spots.length > 0) {
      const spot = spots.find(s => s.id === spotId);
      if (spot && !isNaN(spot.lat) && !isNaN(spot.lng)) {
        setSelectedSpot(spot);
        safeSetFlyToCoords([spot.lat, spot.lng]);
        setDetailViewMode('panel');
        setPanelLayer(1); // Default to Overview tab
        // Clear param without navigation so it stays on /map if refreshed
        window.history.replaceState({}, '', '/map');
      }
    }
  }, [location.search, spots]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleDeleteSpot = async () => {
    if (!spotToDelete) return;
    setIsSubmitting(true);
    try {
      console.log("[MAP_DELETE] Confirmed delete for spot:", spotToDelete.id, "by user:", user?.uid);
      await deleteSharedSpot(spotToDelete.id);
      if (!isMounted.current) return;
      console.log("[MAP_DELETE] Successfully removed from Firestore.");
      
      setToast({ message: `Spot "${spotToDelete.name}" has been deleted.`, type: 'success' });
      setSelectedSpot(null);
      setDetailViewMode(null);
      setIsDeleteDialogOpen(false);
      setSpotToDelete(null);
    } catch (err) {
      console.error("[Map] handleDeleteSpot failure:", err);
      handleFirestoreError(err, OperationType.DELETE, `sharedSpots/${spotToDelete.id}`);
      setToast({ message: "Oops! Delete failed. Please check your connection or permissions.", type: 'error' });
    } finally {
      if (isMounted.current) {
        setIsSubmitting(false);
      }
    }
  };

  const handleSaveName = async () => {
    if (!selectedSpot || !editedName.trim()) return;
    setIsSubmitting(true);
    try {
      await updateSharedSpot(selectedSpot.id, { name: editedName.trim() });
      if (!isMounted.current) return;
      setSelectedSpot({ ...selectedSpot, name: editedName.trim() });
      setIsEditingName(false);
      setToast({ message: "Name updated successfully!", type: "success" });
    } catch (err) {
      console.error("[Map] handleSaveName failure:", err);
      handleFirestoreError(err, OperationType.UPDATE, `sharedSpots/${selectedSpot.id}`);
      setToast({ message: "Failed to update name.", type: "error" });
    } finally {
      if (isMounted.current) {
        setIsSubmitting(false);
      }
    }
  };

  const handleSaveReview = async () => {
    if (!selectedSpot || !newReviewText.trim()) return;
    setIsSubmitting(true);
    try {
      const getUserDisplayName = (u: { username?: string; displayName?: string | null; email?: string | null }) => {
        if (u.username) return `@${u.username}`;
        if (u.displayName) return u.displayName;
        return u.email || 'Anonymous User';
      };
      const newReviewBy = newReviewName || getUserDisplayName(user || {}) || "Anonymous User";
      const newReview: ReviewRecord = {
        id: Math.random().toString(36).substring(2, 9),
        name: newReviewBy,
        rating: newReviewRating,
        text: newReviewText.trim(),
        foodRating: newReviewFoodRating || undefined,
        serviceRating: newReviewServiceRating || undefined,
        atmosphereRating: newReviewAtmosphereRating || undefined,
        media: newReviewMedia.length > 0 ? newReviewMedia : undefined,
        createdAt: Date.now(),
      };

      const updatedReviews = [newReview, ...(selectedSpot.reviews || [])];
      await updateSharedSpot(selectedSpot.id, { reviews: updatedReviews });
      
      setSelectedSpot({ ...selectedSpot, reviews: updatedReviews });
      setIsAddingReview(false);
      setNewReviewText("");
      setNewReviewName("");
      setNewReviewRating(5);
      setNewReviewMedia([]);
      setNewReviewFoodRating(null);
      setNewReviewServiceRating(null);
      setNewReviewAtmosphereRating(null);
      
      setToast({ message: "Review posted!", type: "success" });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `sharedSpots/${selectedSpot.id}`);
      setToast({ message: "Failed to post review.", type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteReview = async () => {
    if (!reviewToDelete || !selectedSpot) return;
    setIsSubmitting(true);
    try {
      if (reviewToDelete.isCommunity) {
        // Community reviews are filtered via linkedSpotId, but we can't delete another user's post easily here 
        // without a separate function. However, the user specifically asked for "delete review" in the rate & review section.
        // For simplicity and safety, we'll focus on the 'reviews' array in sharedSpots first.
        setToast({ message: "Deleting community posts directly from Map is restricted to Firestore cleanup.", type: "error" });
      } else {
        const updatedReviews = (selectedSpot.reviews || []).filter(r => r.id !== reviewToDelete.reviewId);
        await updateSharedSpot(selectedSpot.id, { reviews: updatedReviews });
        setSelectedSpot({ ...selectedSpot, reviews: updatedReviews });
        setToast({ message: "Review deleted successfully.", type: "success" });
      }
      setReviewToDelete(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `sharedSpots/${selectedSpot.id}`);
      setToast({ message: "Failed to delete review.", type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateAverageRating = (spot: Spot, posts: CommunityPost[]) => {
    let totalStars = 0;
    let count = 0;

    // From spot owner's initial rating
    if (spot.rating) {
      totalStars += spot.rating;
      count++;
    }

    // From spot's reviews array
    if (spot.reviews && spot.reviews.length > 0) {
      spot.reviews.forEach(r => {
        totalStars += r.rating;
        count++;
      });
    }

    // From community posts
    if (posts && posts.length > 0) {
      posts.forEach(p => {
        if (p.rating) {
          totalStars += p.rating;
          count++;
        }
      });
    }

    if (count === 0) return 0;
    return parseFloat((totalStars / count).toFixed(1));
  };

  const [weatherData, setWeatherData] = useState<{
    temp: number;
    condition: string;
    humidity: number;
    windSpeed: number;
    address: string;
  } | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  useEffect(() => {
    if (!isWeatherOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".weather-popup") && !target.closest(".weather-button")) {
        setIsWeatherOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isWeatherOpen]);

  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formCategory, setFormCategory] = useState(MAIN_CATEGORIES[0]);
  const [formOpening, setFormOpening] = useState("08:00");
  const [formClosing, setFormClosing] = useState("22:00");
  const [formDistrict, setFormDistrict] = useState<string | null>(null);
  const [formPrice, setFormPrice] = useState("$$");
  const [formPriceAmount, setFormPriceAmount] = useState("");
  const [formReview, setFormReview] = useState("");
  const [formReviewName, setFormReviewName] = useState("");
  const [formRating, setFormRating] = useState(5);
  const [formFoodRating, setFormFoodRating] = useState<number | null>(null);
  const [formServiceRating, setFormServiceRating] = useState<number | null>(null);
  const [formAtmosphereRating, setFormAtmosphereRating] = useState<number | null>(null);
  const [previewFiles, setPreviewFiles] = useState<string[]>([]);
  const [reviewMediaFiles, setReviewMediaFiles] = useState<string[]>([]);
  const [currentMapCenter, setCurrentMapCenter] = useState<[number, number] | null>(null);
  const [showSearchAreaBtn, setShowSearchAreaBtn] = useState(false);

  const handleMapMove = (center: L.LatLng) => {
    setCurrentMapCenter([center.lat, center.lng]);
    setShowSearchAreaBtn(true);
  };
  const [geocodingError, setGeocodingError] = useState<string | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<Record<string, unknown>[]>([]);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  const [route, setRoute] = useState<[number, number][] | null>(null);
  const [routeSpotId, setRouteSpotId] = useState<string | null>(null);

  // Debounce for address suggestions
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(formAddress);
    }, 800);
    return () => clearTimeout(timer);
  }, [formAddress]);

  useEffect(() => {
    if (debouncedSearchQuery.length >= 3 && geocodingStatus === "idle") {
      fetchSuggestions(debouncedSearchQuery);
    }
  }, [debouncedSearchQuery]);

  const fetchSuggestions = async (query: string) => {
    if (!query || query.length < 3) {
      setAddressSuggestions([]);
      return;
    }

    let success = false;
    for (const mirror of NOMINATIM_MIRRORS) {
      try {
        const url = `${mirror}/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1&accept-language=en`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'DateVia-Adventure-App/1.1' },
          signal: AbortSignal.timeout(6000) // 6s per mirror
        });
        
        if (res.ok) {
          const data = await res.json();
          const mapped = data.map((item: { display_name: string; lon: string; lat: string; name?: string }) => ({
            place_name: item.display_name,
            center: [parseFloat(item.lon), parseFloat(item.lat)],
            text: item.name || item.display_name.split(',')[0],
            properties: { address: item.display_name }
          }));
          setAddressSuggestions(mapped);
          success = true;
          break; // Exit loop on success
        }
      } catch (err: unknown) {
        console.warn(`[SUGGESTION] Mirror ${mirror} failed:`, err);
      }
    }

    if (!success) {
      console.error("[SUGGESTION] All geocoding mirrors failed for suggestions.");
    }
  };

  const fetchDiscoveryPoints = () => {
    // Discovery of OSM spots is disabled per user request
  };

  useEffect(() => {
    if (userLocation && !hasCentered) {
       // Detection points logic is disabled per request, but we trigger it once on center
    }
  }, [hasCentered, userLocation]);

  const toggleDirection = async (spot: Spot) => {
    if (routeSpotId === spot.id) {
      setRoute(null);
      setRouteSpotId(null);
      return;
    }

    if (!userLocation) {
      alert("Please enable location to get directions.");
      return;
    }

    try {
      const url = `${OSRM_BASE}/route/v1/driving/${userLocation[1]},${userLocation[0]};${spot.lng},${spot.lat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.routes && data.routes[0]) {
        const coords = data.routes[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
        setRoute(coords as [number, number][]);
        setRouteSpotId(spot.id);
        safeSetFlyToCoords([spot.lat, spot.lng]);
        setDetailViewMode("popup");
      }
    } catch (err) {
      console.error("Routing error:", err);
      alert("Could not calculate route.");
    }
  };

  const geocodeAddress = async (address: string) => {
    if (!address || address.length < 3 || address === "Detecting address...") {
      console.warn("[GEOCODE] Invalid address input:", address);
      return null;
    }

    // Check if it looks like coordinates already
    const coordReg = /^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/;
    const match = address.match(coordReg);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        setNewSpotCoords([lat, lng]);
        setGeocodingStatus("success");
        return { lat, lng };
      }
    }
    
    setGeocodingStatus("loading");
    setGeocodingError(null);
    
    const searchStrings = [address];
    if (address.includes(',')) {
      const parts = address.split(',').map(p => p.trim());
      if (parts.length > 1) {
        searchStrings.push(`${parts[0]}, ${parts[parts.length-1]}`);
      }
    }
    
    const houseNumRegex = /^(\d+[a-zA-Z-/]*)?\s+/;
    const withoutHouseNum = address.replace(houseNumRegex, '').trim();
    if (withoutHouseNum && withoutHouseNum !== address && withoutHouseNum.length > 3) {
      searchStrings.push(withoutHouseNum);
    }

    const uniqueSearchStrings = Array.from(new Set(searchStrings));

    for (const searchStr of uniqueSearchStrings) {
      for (const mirror of NOMINATIM_MIRRORS) {
        if (!isMounted.current) return null;
        try {
          console.log(`[GEOCODE] Attempting geocode for: "${searchStr}" via ${mirror}`);
          const q = `${searchStr}${searchStr.toLowerCase().includes("vietnam") ? "" : ", Vietnam"}`;
          const url = `${mirror}/search?format=json&q=${encodeURIComponent(q)}&limit=1&addressdetails=1&accept-language=en`;
          
          const res = await fetch(url, {
            headers: { 'User-Agent': 'DateVia-Adventure-App/1.1' },
            signal: AbortSignal.timeout(5000)
          });

          if (res.ok) {
            const data = await res.json();
            if (data && data[0]) {
              const item = data[0];
              const lat = parseFloat(item.lat);
              const lon = parseFloat(item.lon);
              
              if (!isNaN(lat) && !isNaN(lon)) {
                setNewSpotCoords([lat, lon]);
                setFormAddress(item.display_name);
                setGeocodingStatus("success");
                console.log("[GEOCODE] Resolved successfully:", { lat, lon, address: item.display_name });
                return { lat, lng: lon };
              }
            }
          }
        } catch (err: unknown) {
          console.warn(`[GEOCODE] Mirror ${mirror} failed:`, err);
        }
      }
    }

    setGeocodingStatus("error");
    setGeocodingError("Could not verify address precisely on map. If the pin is correct, you can still save.");
    return null;
  };

  const handleAddSpot = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("[MAP_ADD_SPOT] Submit Triggered");

    // 1. Validation
    const trimmedName = formName.trim();
    const trimmedAddress = formAddress.trim();

    if (!trimmedName || !trimmedAddress || !formCategory) {
      console.warn("[MAP_ADD_SPOT] Validation failed - missing fields:", { name: !!trimmedName, addr: !!trimmedAddress, cat: !!formCategory });
      alert("Name, Address, and Category are required to share a spot.");
      setIsSubmitting(false);
      return;
    }

    if (trimmedAddress === "Detecting address..." || trimmedAddress === "Address not found, please type manually.") {
       console.warn("[MAP_ADD_SPOT] Placeholder address detected");
       alert("Please wait for the address to be detected or enter a valid readable address manually.");
       setIsSubmitting(false);
       return;
    }

    if (isSubmitting) return;

    setIsSubmitting(true);
    const normalizedName = removeVietnameseTones(trimmedName);
    const normalizedAddress = removeVietnameseTones(trimmedAddress);
    
    console.log("[MAP_ADD_SPOT] Start submission process for:", normalizedName);

    try {
      let finalLat: number | null = null;
      let finalLng: number | null = null;

      // 2. Resolve Coordinates
      console.log("[MAP_ADD_SPOT] Checking coordinates for:", formAddress);
      
      // If we already have coords from map click, and the address hasn't changed from what reverse geocode gave us,
      // we can skip the forward geocode to save time and reduce errors.
      // For now, we always try geocode but fall back instantly if we have coords.
      const resolved = await geocodeAddress(formAddress).catch(err => {
        console.warn("[MAP_ADD_SPOT] Forward geocode failed, will fallback to map pin if available:", err);
        return null;
      });
      
      if (resolved) {
        const anyResolved = resolved as { lat: number; lng?: number; lon?: number };
        finalLat = anyResolved.lat;
        finalLng = anyResolved.lng ?? anyResolved.lon ?? null;
        console.log("[MAP_ADD_SPOT] Geocode successful:", { lat: finalLat, lng: finalLng });
      } else if (newSpotCoords) {
        finalLat = newSpotCoords[0];
        finalLng = newSpotCoords[1];
        console.log("[MAP_ADD_SPOT] Geocode failed or skipped, using map pin coordinates:", newSpotCoords);
      }

      if (finalLat === null || finalLng === null) {
        throw new Error("We couldn't find this location on the map. Please click on the map to pin the correct location.");
      }

      // 3. Create Spot
      const spotIcon = CATEGORY_ICON_MAP[formCategory] || ALL_ICONS[0];
      
      const spotData = {
        name: normalizedName,
        address: normalizedAddress,
        lat: finalLat,
        lng: finalLng,
        image: previewFiles[0] || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1000",
        images: previewFiles.length > 0 ? previewFiles : ["https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1000"],
        category: formCategory,
        district: formDistrict,
        openingHour: formOpening,
        closingHour: formClosing,
        priceRange: formPrice,
        priceAmount: formPriceAmount,
        rating: formRating,
        review: formReview,
        reviewName: formReviewName,
        foodRating: formFoodRating,
        serviceRating: formServiceRating,
        atmosphereRating: formAtmosphereRating,
        reviewMedia: reviewMediaFiles,
        icon: spotIcon,
        city: detectedCity,
        userId: user?.uid || "anonymous",
        createdBy: user?.uid || "anonymous",
      };

      console.log("[MAP_ADD_SPOT] Creating spot in Firestore:", spotData);
      const newId = await addSharedSpot(spotData);
      console.log("[MAP_ADD_SPOT] Spot created successfully. ID:", newId);

      // 4. Success handling
      setIsAddModalOpen(false);
      setFormName("");
      setFormAddress("");
      setFormReview("");
      setFormReviewName("");
      setFormPriceAmount("");
      setFormFoodRating(null);
      setFormServiceRating(null);
      setFormAtmosphereRating(null);
      setPreviewFiles([]);
      setReviewMediaFiles([]);
      setNewSpotCoords(null);
      setFormDistrict(null);
      setGeocodingStatus("idle");
      
      setToast({ message: `Spot "${formName}" shared successfully!`, type: 'success' });
      safeSetFlyToCoords([finalLat, finalLng]);
      
    } catch (err: unknown) {
      console.error("[MAP_ADD_SPOT] Error in submission chain:", err);
      let errorMsg = "Failed to add spot. Please try again.";
      
      if (err instanceof Error) {
        try {
          // Try to parse our structured Firestore error
          const parsed = JSON.parse(err.message);
          if (parsed.error && parsed.error.includes("permission")) {
            errorMsg = "Permission denied. Are you signed in with a verified account?";
          } else if (parsed.error) {
            errorMsg = parsed.error;
          } else {
            errorMsg = err.message;
          }
        } catch {
          errorMsg = err.message;
        }
      }
      alert(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const triggerReverseGeocode = async (lat: number, lng: number) => {
    setGeocodingStatus("loading");
    setGeocodingError(null);
    setFormAddress("Detecting address...");
    let success = false;
    for (const mirror of NOMINATIM_MIRRORS) {
      try {
        console.log(`[REVERSE_GEOCODE] Trying mirror: ${mirror}`);
        const url = `${mirror}/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&zoom=18&accept-language=en`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'DateVia-Adventure-App/1.1' },
          signal: AbortSignal.timeout(6000)
        });
        if (res.ok) {
          const data = await res.json();
          console.log(`[REVERSE_GEOCODE] Data from ${mirror}:`, data);
          if (data && (data.display_name || data.address)) {
            const addr = data.address || {};
            // Prefer display_name if detailed enough, otherwise reconstruct
            if (data.display_name && data.display_name.length > 5) {
              setFormAddress(removeVietnameseTones(data.display_name));
            } else if (addr.road) {
              const parts = [addr.road, addr.suburb, addr.city, addr.country].filter(Boolean);
              setFormAddress(removeVietnameseTones(parts.join(", ")));
            } else {
              setFormAddress(removeVietnameseTones(data.display_name || "Location pinned"));
            }
            
            setGeocodingStatus("success");
            
            const districtStr = addr.suburb || addr.city_district || addr.district || addr.neighbourhood || addr.village || addr.subdistrict;
            if (districtStr) {
              setFormDistrict(removeVietnameseTones(districtStr));
            }

            if (!formName || formName === "Pinned Spot" || formName === "Unnamed Spot") {
              const possibleName = data.name || addr.road || addr.suburb || addr.neighbourhood || addr.city;
              setFormName(removeVietnameseTones(possibleName) || "New Date Spot");
            }
            
            success = true;
            break;
          }
        }
      } catch (err: unknown) {
        console.warn(`[REVERSE_GEOCODE] Mirror ${mirror} failed:`, err);
      }
    }
    
    if (!success) {
      console.warn("[REVERSE_GEOCODE] All mirrors failed, returning coordinates.");
      setFormAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      if (!formName) setFormName("Coordinate Spot");
      setGeocodingStatus("success");
    }
  };

  const filteredSpots = useMemo(() => {
    return spots.filter(s => {
      const matchesSearch = !searchQuery ||
        removeVietnameseTones(s.name).toLowerCase().includes(removeVietnameseTones(searchQuery).toLowerCase()) ||
        removeVietnameseTones(s.address).toLowerCase().includes(removeVietnameseTones(searchQuery).toLowerCase());

      const matchesCategory = selectedCategory === "Everywhere" || s.category === selectedCategory;

      const matchesDistrict = selectedDistrict === "All Districts" ||
        (s.district && s.district === selectedDistrict) ||
        (!s.district && s.address.toLowerCase().includes(selectedDistrict.toLowerCase()));

      return matchesSearch && matchesCategory && matchesDistrict;
    });
  }, [spots, searchQuery, selectedCategory, selectedDistrict]);

  const availableDistricts = useMemo(() => {
    return CITY_DISTRICTS[detectedCity] || CITY_DISTRICTS["Ho Chi Minh City"];
  }, [detectedCity]);

  const filteredCategories = useMemo(() => {
    if (!catSearchQuery) return ["Everywhere", ...CATEGORIES];
    return ["Everywhere", ...CATEGORIES.filter(c => c.toLowerCase().includes(catSearchQuery.toLowerCase()))];
  }, [catSearchQuery]);

  const handleRecenter = () => {
    if (userLocation) {
      safeSetFlyToCoords([...userLocation] as LngLat);
    }
  };

  const fetchWeather = async () => {
    setIsWeatherOpen(true);
    setIsLoadingWeather(true);
    setWeatherError(null);

    let lat = DEFAULT_CENTER[0];
    let lng = DEFAULT_CENTER[1];

    try {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        lat = position.coords.latitude;
        lng = position.coords.longitude;
      } catch (geoErr) {
        console.warn("GPS failed, trying fallback:", geoErr);
        if (flyToCoords) {
          lat = flyToCoords[0];
          lng = flyToCoords[1];
        } else if (userLocation) {
          lat = userLocation[0];
          lng = userLocation[1];
        }
      }

      if (isNaN(lat) || isNaN(lng)) {
        throw new Error("Invalid coordinates for weather fetch");
      }

      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`;

      const weatherRes = await fetch(weatherUrl);
      if (!weatherRes.ok) {
        const errorText = await weatherRes.text().catch(() => "No error details");
        console.error(`Weather API Error (${weatherRes.status}):`, errorText);
        throw new Error(`Weather service responded with ${weatherRes.status}`);
      }

      const weatherJson = await weatherRes.json();
      const current = weatherJson.current;
      if (!current) throw new Error("Invalid weather data received");

      let address = "Current Location";
      try {
        let geoSuccess = false;
        for (const mirror of NOMINATIM_MIRRORS) {
          try {
            const geoRes = await fetch(
              `${mirror}/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=en`,
              { 
                headers: { 'User-Agent': 'DateVia-Adventure-App/1.1' },
                signal: AbortSignal.timeout(5000)
              }
            );
            if (geoRes.ok) {
              const geoJson = await geoRes.json();
              if (geoJson && geoJson.display_name) {
                address = geoJson.display_name;
                
                const city = geoJson.address.city || geoJson.address.town || geoJson.address.village;
                if (city) setDetectedCity(city);
                geoSuccess = true;
                break;
              }
            }
          } catch (err) {
             console.warn(`[WEATHER_GEO] Mirror ${mirror} failed:`, err);
          }
        }
        if (!geoSuccess) {
           console.warn("[WEATHER_GEO] All mirrors failed for weather geocoding");
        }
      } catch (err: unknown) {
        console.warn("Geocoding logic error:", err);
      }

      const weatherCodes: Record<number, string> = {
        0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
        45: "Fog", 48: "Depositing rime fog", 51: "Light drizzle", 53: "Moderate drizzle",
        55: "Dense drizzle", 61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
        71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow", 95: "Thunderstorm",
      };

      setWeatherData({
        temp: Math.round(current.temperature_2m),
        condition: weatherCodes[current.weather_code] || "Cloudy",
        humidity: current.relative_humidity_2m || 70,
        windSpeed: current.wind_speed_10m || 0,
        address
      });
    } catch (err) {
      console.error("Weather fetch error details:", err);
      setWeatherError("Unable to load weather right now.");
    } finally {
      setIsLoadingWeather(false);
    }
  };

  const userIcon = useMemo(() => L.divIcon({
    className: "custom-div-icon",
    html: `
      <div class="relative">
        <div class="absolute inset-0 bg-blue-500 rounded-full blur-md opacity-40 animate-pulse"></div>
        <img src="${YourHomeIcon}" style="width: 36px; height: 36px; position: relative; z-index: 10; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));" />
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  }), []);

  return (
    <div className="flex flex-col gap-5 h-auto lg:h-[calc(100vh-100px)] overflow-hidden p-2 sm:p-4 lg:p-0">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulse {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(253,96,36,0.7); }
          70% { transform: scale(1.1); box-shadow: 0 0 0 10px rgba(253,96,36,0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(253,96,36,0); }
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-popup .leaflet-popup-content-wrapper { border-radius: 24px; padding: 0; overflow: hidden; border: none; box-shadow: 0 20px 40px rgba(0,0,0,0.3); }
        .custom-popup .leaflet-popup-content { margin: 0; width: 300px !important; }
        .custom-popup .leaflet-popup-tip { background: white; }
        .dark .custom-popup .leaflet-popup-tip { background: #171717; }
        .custom-tooltip { background: white !important; border: none !important; border-radius: 14px !important; box-shadow: 0 10px 30px rgba(0,0,0,0.2) !important; padding: 0 !important; width: 220px !important; min-width: 200px !important; }
        .dark .custom-tooltip { background: #171717 !important; }
        .custom-tooltip::before { display: none !important; }
        .spot-marker-icon {
          transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), filter 0.3s ease;
          display: block;
        }
        .spot-marker-selected {
          transform: scale(1.3) translateY(-4px) !important;
          filter: drop-shadow(0 8px 15px rgba(253,96,36,0.5)) !important;
          z-index: 1000 !important;
        }
        .spot-marker-icon img {
          width: 42px;
          height: 42px;
          object-fit: contain;
          filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));
        }
      `}} />

      <div className="flex items-center justify-between gap-4 shrink-0 px-1 pt-2">
        <div className="flex flex-col space-y-1">
          <h2
            className="text-[24px] leading-[1.05] tracking-tight text-text"
            style={{ fontFamily: FONT_CHANGA }}
          >
            {t("common.map")}
          </h2>
          <p
            className="text-[11px] text-text-muted font-medium"
            style={{ fontFamily: FONT_DM_SANS }}
          >
            Discover and share the best date spots
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-5 relative flex-1 min-h-0 items-stretch overflow-hidden">
        <div className="flex lg:flex w-full lg:w-[380px] h-[300px] md:h-[400px] lg:h-full flex-col gap-4 z-20 min-h-0 shrink-0">
          <div className="glass rounded-[30px] overflow-hidden flex flex-col flex-1 min-h-0 relative shadow-xl">
            <div className="p-5 border-b border-black/5 dark:border-white/5 space-y-5 bg-white/40 dark:bg-black/30">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted transition-colors group-focus-within:text-accent-orange" />
                <input
                  type="text"
                  placeholder="Search city, category or place..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-3 rounded-2xl bg-white/50 dark:bg-black/20 border border-black/5 dark:border-white/5 text-sm outline-none focus:ring-2 focus:ring-accent-orange/20 transition-all font-medium"
                />
              </div>

              <div className="space-y-2 relative">
                <label className="text-[11px] font-bold uppercase tracking-widest text-text-muted dark:text-[#DDE7C7] px-1 flex items-center gap-2">
                  <FilterIcon className="w-3 h-3" /> Filters & Categories
                </label>
                <button
                  onClick={() => {
                    setIsCatDropdownOpen(!isCatDropdownOpen);
                    setIsDistDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 bg-white/50 dark:bg-black/20 border border-black/5 dark:border-white/5 rounded-2xl text-sm font-medium transition-all hover:bg-white/80 dark:hover:bg-black/40"
                >
                  <span className="truncate">{selectedCategory}</span>
                  <ChevronDown className={`w-4 h-4 text-text-muted transition-transform duration-300 ${isCatDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence>
                  {isCatDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-white/95 dark:bg-black/95 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden"
                    >
                      <div className="p-2 border-b border-black/5 dark:border-white/5">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
                          <input
                            type="text"
                            placeholder="Find category..."
                            value={catSearchQuery}
                            onChange={(e) => setCatSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-4 py-2 bg-black/5 dark:bg-white/5 rounded-xl text-xs outline-none"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>
                      <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-1">
                        {filteredCategories.map(cat => (
                          <button
                            key={cat}
                            onClick={() => {
                              setSelectedCategory(cat);
                              setIsCatDropdownOpen(false);
                              setCatSearchQuery("");
                            }}
                            className={`w-full text-left px-4 py-2.5 rounded-xl text-sm transition-colors flex items-center justify-between ${selectedCategory === cat ? "bg-accent-orange/10 text-accent-orange font-bold" : "hover:bg-black/5 dark:hover:bg-white/5"}`}
                          >
                            <div className="flex items-center gap-3">
                              {cat !== "Everywhere" && CATEGORY_ICON_MAP[cat] && (
                                <img src={CATEGORY_ICON_MAP[cat]} alt="" className="w-5 h-5 object-contain" />
                              )}
                              <span>{cat}</span>
                            </div>
                            {selectedCategory === cat && <Check className="w-3.5 h-3.5" />}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="space-y-2 relative">
                <label className="font-['DM_Sans'] text-xs font-bold uppercase tracking-tight text-text-muted dark:text-[#DDE7C7] px-1">District</label>
                <button
                  onClick={() => {
                    setIsDistDropdownOpen(!isDistDropdownOpen);
                    setIsCatDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 bg-white/50 dark:bg-black/20 border border-black/5 dark:border-white/5 rounded-2xl text-sm font-medium transition-all hover:bg-white/80 dark:hover:bg-black/40"
                >
                  <span className="truncate">{selectedDistrict}</span>
                  <ChevronDown className={`w-4 h-4 text-text-muted transition-transform duration-300 ${isDistDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence>
                  {isDistDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-white/95 dark:bg-black/95 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden"
                    >
                      <div className="max-h-[250px] overflow-y-auto custom-scrollbar p-1">
                        <button
                          onClick={() => {
                            setSelectedDistrict("All Districts");
                            setIsDistDropdownOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2.5 rounded-xl text-sm transition-colors flex items-center justify-between ${selectedDistrict === "All Districts" ? "bg-accent-orange/10 text-accent-orange font-bold" : "hover:bg-black/5 dark:hover:bg-white/5"}`}
                        >
                          All Districts
                          {selectedDistrict === "All Districts" && <Check className="w-3.5 h-3.5" />}
                        </button>
                        {availableDistricts.map(dist => (
                          <button
                            key={dist}
                            onClick={() => {
                              setSelectedDistrict(dist);
                              setIsDistDropdownOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2.5 rounded-xl text-sm transition-colors flex items-center justify-between ${selectedDistrict === dist ? "bg-accent-orange/10 text-accent-orange font-bold" : "hover:bg-black/5 dark:hover:bg-white/5"}`}
                          >
                            {dist}
                            {selectedDistrict === dist && <Check className="w-3.5 h-3.5" />}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="p-4 border-b border-black/5 dark:border-white/5 flex items-center justify-between shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted dark:text-[#F6D8C8]">{filteredSpots.length} Results found</span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 custom-scrollbar">
              {filteredSpots.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 opacity-60">
                  <MapPin className="lucide-icon w-12 h-12 mb-2 text-accent-orange" />
                  <p className="text-xs font-bold leading-relaxed dark:text-[#FFD6B8]">No spots found.<br />Add your first one!</p>
                </div>
              ) : (
                filteredSpots.map(spot => (
                  <motion.div
                    key={spot.id}
                    layout
                    onClick={() => {
                      setSelectedSpot(spot);
                      setDetailViewMode("panel");
                      safeSetFlyToCoords([spot.lat, spot.lng]);
                    }}
                    className={`group p-2.5 rounded-2xl cursor-pointer transition-all flex gap-3 border ${selectedSpot?.id === spot.id ? "bg-accent-orange/10 border-accent-orange/30" : "bg-white/50 dark:bg-black/30 border-transparent hover:border-black/5 dark:hover:border-white/5 hover:bg-white/80 dark:hover:bg-black/50"}`}
                  >
                    <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 shadow-md">
                      <img
                        src={spot.image || undefined}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1000";
                        }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between items-start mb-0.5">
                        <h4 className="text-sm font-bold truncate pr-2 dark:text-white" style={{ fontFamily: FONT_CHANGA }}>{spot.name}</h4>
                        {(() => {
                          // Simple local calculation for list view
                          const reviewsCount = (spot.reviews?.length || 0) + (spot.rating ? 1 : 0);
                          const sum = (spot.reviews?.reduce((acc, curr) => acc + curr.rating, 0) || 0) + (spot.rating || 0);
                          const avg = reviewsCount > 0 ? (sum / reviewsCount).toFixed(1) : "0.0";
                          return avg !== "0.0" ? (
                            <div className="flex items-center gap-0.5 shrink-0 bg-accent-orange/5 px-1.5 py-0.5 rounded-full">
                              <Star className="w-2.5 h-2.5 fill-accent-orange text-accent-orange" />
                              <span className="text-[9px] font-black text-accent-orange">{avg}</span>
                            </div>
                          ) : null;
                        })()}
                      </div>
                      <p className="text-[10px] text-text-muted dark:text-[#FFD6B8] truncate mb-1">{spot.address}</p>
                      <div className="flex items-center gap-1.5">
                        <img 
                          src={CATEGORY_ICON_MAP[spot.category] || ALL_ICONS[0]} 
                          alt="" 
                          className="w-3.5 h-3.5 object-contain" 
                        />
                        <span className="inline-block px-2 py-0.5 rounded-full bg-accent-orange/10 dark:bg-white/[0.08] text-[8px] font-bold text-accent-orange dark:text-[#FFD6B8] uppercase tracking-wider">
                          {spot.category}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className={`flex-1 glass rounded-[38px] overflow-hidden relative z-10 w-full shadow-2xl border border-white/20 dark:border-white/5 ${isPickingFromMap || isHidingModalForPin ? 'cursor-crosshair' : ''}`}>
          {/* Map Picking Banner */}
          <AnimatePresence>
            {(isPickingFromMap || isHidingModalForPin) && (
              <motion.div
                initial={{ y: -100, opacity: 0 }}
                animate={{ y: 20, opacity: 1 }}
                exit={{ y: -100, opacity: 0 }}
                className="absolute top-0 left-1/2 -translate-x-1/2 z-[2000] w-max max-w-[90%]"
              >
                <div className="bg-black/80 backdrop-blur-md text-white px-6 py-4 rounded-[24px] shadow-2xl flex items-center gap-4 border border-white/10">
                  <div className="w-10 h-10 bg-accent-orange/20 rounded-full flex items-center justify-center animate-pulse">
                    <MapPin className="w-5 h-5 text-accent-orange" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-black uppercase tracking-wider leading-tight" style={{ fontFamily: FONT_CHANGA }}>Pin Mode Active</span>
                    <span className="text-[10px] text-white/70 font-medium tracking-wide">Tap anywhere on the map to drop a pin</span>
                  </div>
                  <button 
                    onClick={() => {
                      setIsPickingFromMap(false);
                      setIsHidingModalForPin(false);
                      if (isHidingModalForPin) setIsAddModalOpen(true);
                    }}
                    className="ml-2 p-2 hover:bg-white/10 rounded-xl transition-colors active:scale-95"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <MapContainer
            center={DEFAULT_CENTER}
            zoom={13}
            className="w-full h-full"
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />

            <MapController
              center={flyToCoords}
              isCaptureMode={isHidingModalForPin || isPickingFromMap}
              onBackgroundClick={() => {
                if (!isHidingModalForPin && !isPickingFromMap) {
                  setSelectedSpot(null);
                  setDetailViewMode(null);
                  setRoute(null);
                  setRouteSpotId(null);
                }
              }}
              onMoveEnd={(center) => {
                handleMapMove(center);
                fetchDiscoveryPoints();
              }}
              onMapClick={async (latlng) => {
                if (latlng && !isNaN(latlng.lat) && !isNaN(latlng.lng)) {
                  if (isHidingModalForPin || isPickingFromMap) {
                    setNewSpotCoords([latlng.lat, latlng.lng]);
                    setIsHidingModalForPin(false);
                    setIsPickingFromMap(false);
                    setIsAddModalOpen(true);
                    await triggerReverseGeocode(latlng.lat, latlng.lng);
                  } else if (!isAddModalOpen) {
                    // Standard flow: double click to quick add
                    console.log("[MAP_PIN] Quick add trigger");
                    setNewSpotCoords([latlng.lat, latlng.lng]);
                    setIsAddModalOpen(true);
                    await triggerReverseGeocode(latlng.lat, latlng.lng);
                  }
                }
              }}
            />

            {route && (
              <Polyline
                positions={route}
                pathOptions={{
                  color: "#FD6024",
                  weight: 5,
                  opacity: 0.8,
                  lineCap: "round"
                }}
              />
            )}

            {userLocation && (
              <Marker position={userLocation} icon={userIcon}>
                <Popup autoPan={false}>You are here</Popup>
              </Marker>
            )}

            {newSpotCoords && isAddModalOpen && (
              <Marker 
                key="new-spot-marker"
                position={newSpotCoords}
                icon={L.divIcon({
                  className: "custom-div-icon",
                  html: `
                    <div style="
                      width: 42px;
                      height: 42px;
                      background: white;
                      border: 3px solid #FD6024;
                      border-radius: 50%;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      box-shadow: 0 4px 15px rgba(253,96,36,0.4);
                    ">
                      <div style="width: 14px; height: 14px; background: #FD6024; border-radius: 50%; animation: pulse 2s infinite;"></div>
                    </div>
                  `,
                  iconSize: [42, 42],
                  iconAnchor: [21, 21]
                })}
              />
            )}

            {/* OSM Discovery Layer Removed */}

            {filteredSpots.map(spot => (
              <React.Fragment key={spot.id}>
                <SpotMarker 
                  spot={spot}
                  isSelected={spot.id === selectedSpot?.id}
                  onSelect={(s) => {
                    console.log("[MAP_MARKER] Clicked spot:", s.name);
                    setSelectedSpot(s);
                    setDetailViewMode("panel");
                    setPanelLayer(1); // ALWAYS default to Overview tab when clicking a marker
                    safeSetFlyToCoords([s.lat, s.lng]);
                  }}
                />
              </React.Fragment>
            ))}
          </MapContainer>

          <div className="absolute top-5 right-5 z-[500] flex flex-col gap-2">
            {showSearchAreaBtn && (
              <motion.button
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => {
                  if (currentMapCenter) {
                    fetchDiscoveryPoints();
                    setShowSearchAreaBtn(false);
                  }
                }}
                className="mb-2 px-4 py-2 bg-accent-orange text-white rounded-full text-[10px] font-bold uppercase tracking-widest shadow-xl shadow-accent-orange/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
              >
                <Search className="w-3.5 h-3.5" />
                Search This Area
              </motion.button>
            )}
            <button
              onClick={fetchWeather}
              title="View weather"
              className="weather-button w-12 h-12 flex items-center justify-center bg-white/90 dark:bg-surface-dark border border-black/5 dark:border-white/10 rounded-2xl shadow-xl backdrop-blur-md hover:scale-105 active:scale-95 transition-all overflow-hidden"
            >
              <img
                src={WeatherIcon}
                alt="Weather"
                className="w-7 h-7 object-contain"
              />
            </button>

            <button
              onClick={handleRecenter}
              title="Find my location"
              className="w-12 h-12 flex items-center justify-center bg-white/90 dark:bg-surface-dark border border-black/5 dark:border-white/10 rounded-2xl shadow-xl text-accent-orange backdrop-blur-md hover:scale-105 active:scale-95 transition-all overflow-hidden"
            >
              <img
                src={YourHomeIcon}
                alt="Your home location"
                className="w-11 h-11 object-contain"
              />
            </button>

            <button
              onClick={() => {
                setIsPickingFromMap(true);
                setFormAddress("");
                setNewSpotCoords(null);
              }}
              title="Add a new spot"
              className={`group relative w-12 h-12 flex items-center justify-center border rounded-2xl shadow-xl backdrop-blur-md hover:scale-105 active:scale-95 transition-all ${isPickingFromMap ? "bg-accent-orange text-white border-accent-orange" : "bg-white/90 dark:bg-surface-dark text-accent-orange border-accent-orange/40 dark:border-accent-orange/50"}`}
            >
              <Plus className="w-5 h-5" />
              <span className="absolute right-full mr-3 px-3 py-1.5 bg-black/80 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none uppercase tracking-widest">
                {isPickingFromMap ? "Cancel Picking" : "Add Spots"}
              </span>
            </button>
          </div>

          <AnimatePresence>
            {isWeatherOpen && (
              <motion.div
                initial={{ opacity: 0, x: 20, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.9 }}
                className="weather-popup absolute top-5 right-20 z-[600] glass p-4 rounded-[24px] shadow-2xl border border-white/20 max-w-[320px]"
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-accent-orange">Live Weather</span>
                  <button onClick={() => setIsWeatherOpen(false)} className="p-1 hover:bg-black/5 rounded-full transition-colors">
                    <X className="w-3 h-3 text-text-muted" />
                  </button>
                </div>

                {isLoadingWeather ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="w-5 h-5 border-2 border-accent-orange border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : weatherError ? (
                  <p className="text-[10px] text-red-500 font-medium py-1">{weatherError}</p>
                ) : weatherData ? (
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold" style={{ fontFamily: FONT_CHANGA }}>{weatherData.temp}°C</span>
                      <span className="text-xs font-bold text-text-main capitalize">{weatherData.condition}</span>
                    </div>
                    <p className="text-[10px] text-text-muted font-semibold leading-relaxed">
                      Humidity {weatherData.humidity}% — {weatherData.address}
                    </p>
                  </div>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {selectedSpot && detailViewMode === "panel" && (
              <motion.div
                initial={{ opacity: 0, x: 50, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 50, scale: 0.95 }}
                className="absolute top-2 bottom-2 left-2 right-2 md:top-6 md:bottom-6 md:right-6 md:left-auto w-auto md:w-full md:max-w-[380px] z-[500] glass p-4 md:p-5 rounded-[24px] md:rounded-[32px] shadow-2xl border border-white/20 flex flex-col pointer-events-auto overflow-hidden"
              >
                <div className="flex justify-between items-center mb-6 shrink-0 px-1 border-b border-black/5 dark:border-white/5 pb-2">
                  <div className="flex gap-4">
                    <button
                      onClick={() => setPanelLayer(1)}
                      className={`text-[11px] font-black uppercase tracking-widest transition-all relative ${panelLayer === 1 ? "text-accent-orange" : "text-text-muted"}`}
                    >
                      Overview
                      {panelLayer === 1 && (
                        <motion.div layoutId="activeTab" className="absolute -bottom-2.5 left-0 right-0 h-0.5 bg-accent-orange" />
                      )}
                    </button>
                    <button
                      onClick={() => setPanelLayer(0)}
                      className={`text-[11px] font-black uppercase tracking-widest transition-all relative ${panelLayer === 0 ? "text-accent-orange" : "text-text-muted"}`}
                    >
                      Rating Post
                      {panelLayer === 0 && (
                        <motion.div layoutId="activeTab" className="absolute -bottom-2.5 left-0 right-0 h-0.5 bg-accent-orange" />
                      )}
                    </button>
                    <button
                      onClick={() => setPanelLayer(2)}
                      className={`text-[11px] font-black uppercase tracking-widest transition-all relative ${panelLayer === 2 ? "text-accent-orange" : "text-text-muted"}`}
                    >
                      Menu
                      {panelLayer === 2 && (
                        <motion.div layoutId="activeTab" className="absolute -bottom-2.5 left-0 right-0 h-0.5 bg-accent-orange" />
                      )}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    {user?.uid && (
                      <button
                        onClick={() => {
                          setSpotToDelete(selectedSpot);
                          setIsDeleteDialogOpen(true);
                        }}
                        className="p-1.5 bg-red-500/10 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-colors"
                        title="Delete spot"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setSelectedSpot(null);
                        setDetailViewMode(null);
                      }}
                      className="p-1.5 bg-black/5 dark:bg-white/10 rounded-full hover:bg-black/10 transition-colors"
                    >
                      <X className="w-4 h-4 text-text-main dark:text-white" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 min-h-0 relative">
                  {panelLayer === 0 ? (
                    <div className="w-full h-full flex flex-col min-h-0 px-1 overflow-y-auto no-scrollbar">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.1em] text-accent-orange">User Experience & Reviews</h4>
                        <button 
                          onClick={() => setIsAddingReview(!isAddingReview)}
                          className="p-1.5 bg-accent-orange/10 text-accent-orange rounded-full hover:bg-accent-orange hover:text-white transition-all shadow-sm"
                        >
                          <Plus className={`w-3.5 h-3.5 transition-transform ${isAddingReview ? 'rotate-45' : ''}`} />
                        </button>
                      </div>

                      <div className="space-y-4 pb-4">
                        <AnimatePresence>
                          {isAddingReview && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden mb-4"
                            >
                              <div className="bg-black/5 dark:bg-white/5 rounded-2xl p-4 border border-accent-orange/20 space-y-3">
                                <div className="space-y-2">
                                  <label className="text-[8px] font-bold uppercase tracking-widest text-text-muted">Your Review</label>
                                  <textarea
                                    value={newReviewText}
                                    onChange={(e) => setNewReviewText(e.target.value)}
                                    placeholder="Let people know about your experience..."
                                    className="w-full p-3 bg-white dark:bg-black/20 rounded-xl text-xs outline-none focus:ring-1 focus:ring-accent-orange/30 min-h-[80px]"
                                  />
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <label className="text-[8px] font-bold uppercase tracking-widest text-text-muted">Nick Name</label>
                                    <input
                                      type="text"
                                      value={newReviewName}
                                      onChange={(e) => setNewReviewName(e.target.value)}
                                      placeholder="Optional"
                                      className="w-full p-2 bg-white dark:bg-black/20 rounded-lg text-xs outline-none"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[8px] font-bold uppercase tracking-widest text-text-muted">Rating / 5</label>
                                    <div className="flex gap-1">
                                      {[1, 2, 3, 4, 5].map((num) => (
                                        <button
                                          key={num}
                                          onClick={() => setNewReviewRating(num)}
                                          className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${newReviewRating >= num ? "bg-accent-orange text-white" : "bg-black/5 dark:bg-white/5"}`}
                                        >
                                          <Star className={`w-3 h-3 ${newReviewRating >= num ? "fill-white" : "text-text-muted"}`} />
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 gap-3">
                                  <div className="flex items-center justify-between">
                                    <label className="text-[8px] font-bold uppercase tracking-widest text-text-muted">Food Rating</label>
                                    <div className="flex gap-1">
                                      {[1, 2, 3, 4, 5].map((num) => (
                                        <button key={num} onClick={() => setNewReviewFoodRating(num)} className={`w-5 h-5 rounded flex items-center justify-center transition-all ${newReviewFoodRating && newReviewFoodRating >= num ? "bg-accent-orange text-white" : "bg-black/5 dark:bg-white/5"}`}>
                                          <Star className={`w-2.5 h-2.5 ${newReviewFoodRating && newReviewFoodRating >= num ? "fill-white" : "text-text-muted"}`} />
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <label className="text-[8px] font-bold uppercase tracking-widest text-text-muted">Service Rating</label>
                                    <div className="flex gap-1">
                                      {[1, 2, 3, 4, 5].map((num) => (
                                        <button key={num} onClick={() => setNewReviewServiceRating(num)} className={`w-5 h-5 rounded flex items-center justify-center transition-all ${newReviewServiceRating && newReviewServiceRating >= num ? "bg-accent-orange text-white" : "bg-black/5 dark:bg-white/5"}`}>
                                          <Star className={`w-2.5 h-2.5 ${newReviewServiceRating && newReviewServiceRating >= num ? "fill-white" : "text-text-muted"}`} />
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <label className="text-[8px] font-bold uppercase tracking-widest text-text-muted">Atmosphere</label>
                                    <div className="flex gap-1">
                                      {[1, 2, 3, 4, 5].map((num) => (
                                        <button key={num} onClick={() => setNewReviewAtmosphereRating(num)} className={`w-5 h-5 rounded flex items-center justify-center transition-all ${newReviewAtmosphereRating && newReviewAtmosphereRating >= num ? "bg-accent-orange text-white" : "bg-black/5 dark:bg-white/5"}`}>
                                          <Star className={`w-2.5 h-2.5 ${newReviewAtmosphereRating && newReviewAtmosphereRating >= num ? "fill-white" : "text-text-muted"}`} />
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex gap-2">
                                  <label className="flex-1 flex flex-col items-center justify-center p-3 border-2 border-dashed border-black/10 dark:border-white/10 rounded-xl cursor-pointer hover:bg-black/5 transition-all text-text-muted text-center gap-1">
                                    <Upload className="w-4 h-4" />
                                    <span className="text-[8px] font-bold uppercase tracking-widest">Add Media</span>
                                    <input
                                      type="file"
                                      multiple
                                      accept="image/*"
                                      className="hidden"
                                      onChange={async (e) => {
                                        const files = Array.from(e.target.files || []);
                                        const base64s = await Promise.all(
                                          files.map(async (file) => {
                                            const base64 = await toBase64(file);
                                            return await compressImage(base64);
                                          })
                                        );
                                        setNewReviewMedia([...newReviewMedia, ...base64s]);
                                      }}
                                    />
                                  </label>
                                  {newReviewMedia.length > 0 && (
                                    <div className="flex-1 flex gap-1 overflow-x-auto py-1 scrollbar-hide">
                                      {newReviewMedia.map((url, i) => (
                                        <div key={i} className="relative group w-12 h-12 rounded-lg overflow-hidden shrink-0">
                                          <img src={url} alt="" className="w-full h-full object-cover" />
                                          <button
                                            onClick={() => setNewReviewMedia(newReviewMedia.filter((_, idx) => idx !== i))}
                                            className="absolute top-0 right-0 p-0.5 bg-black/60 text-white rounded-bl-lg transition-opacity"
                                          >
                                            <X className="w-2.5 h-2.5" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <button
                                  onClick={handleSaveReview}
                                  disabled={isSubmitting || !newReviewText.trim()}
                                  className="w-full py-4 bg-accent-orange text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-accent-orange/20 active:scale-95 transition-all disabled:opacity-50"
                                >
                                  {isSubmitting ? "Publishing..." : "Submit Review"}
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Recent Reviews List */}
                        <div className="space-y-4">
                          {/* Display original review if it exists */}
                          {(selectedSpot.review || selectedSpot.rating) && (
                            <div className="p-4 rounded-[24px] bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 flex flex-col gap-3">
                              <div className="flex justify-between items-center">
                                <span className="text-[11px] font-black dark:text-white">{selectedSpot.reviewName || "Anonymous Creator"}</span>
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1 bg-accent-orange/10 px-2 py-0.5 rounded-full">
                                    <Star className="w-3 h-3 fill-accent-orange text-accent-orange" />
                                    <span className="text-[10px] font-black text-accent-orange">{selectedSpot.rating || 5}.0</span>
                                  </div>
                                </div>
                              </div>
                              <p className="text-[11px] text-text-main dark:text-neutral-300 leading-relaxed italic border-l-2 border-accent-orange/30 pl-3">
                                "{selectedSpot.review || "Loved this place!"}"
                              </p>
                              {selectedSpot.reviewMedia && selectedSpot.reviewMedia.length > 0 && (
                                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                                  {selectedSpot.reviewMedia.map((url, i) => (
                                    <div key={i} className="w-16 h-16 rounded-xl overflow-hidden shrink-0 shadow-sm border border-black/5 cursor-pointer" onClick={() => setLightboxImage(url)}>
                                      <img src={url} alt="" className="w-full h-full object-cover" />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Display additional reviews */}
                          {selectedSpot.reviews?.map((rev) => (
                             <div key={rev.id} className="p-4 rounded-[24px] bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 flex flex-col gap-3">
                              <div className="flex justify-between items-center">
                                <span className="text-[11px] font-black dark:text-white">{rev.name}</span>
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1 bg-accent-orange/10 px-2 py-0.5 rounded-full">
                                    <Star className="w-3 h-3 fill-accent-orange text-accent-orange" />
                                    <span className="text-[10px] font-black text-accent-orange">{rev.rating}.0</span>
                                  </div>
                                  {isAdmin && (
                                    <div className="relative group/menu">
                                      <button className="p-1 text-text-muted hover:bg-black/5 rounded-full transition-colors">
                                        <MoreVertical className="w-3.5 h-3.5" />
                                      </button>
                                      <div className="absolute top-full right-0 mt-1 hidden group-hover/menu:block z-20">
                                        <button 
                                          onClick={() => setReviewToDelete({ spotId: selectedSpot.id, reviewId: rev.id })}
                                          className="bg-white dark:bg-neutral-800 shadow-xl border border-black/5 rounded-xl px-4 py-2 text-[10px] font-bold text-red-500 hover:bg-red-50"
                                        >
                                          Delete Review
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <p className="text-[11px] text-text-main dark:text-neutral-300 leading-relaxed pl-1">
                                {rev.text}
                              </p>
                              <span className="text-[8px] text-text-muted uppercase tracking-widest">{formatDate(rev.createdAt)}</span>
                              {rev.media && rev.media.length > 0 && (
                                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                                  {rev.media.map((url, i) => (
                                    <div 
                                      key={i} 
                                      className="w-16 h-16 rounded-xl overflow-hidden shrink-0 shadow-sm border border-black/5 cursor-pointer"
                                      onClick={() => setLightboxImage(url)}
                                    >
                                      <img src={url} alt="" className="w-full h-full object-cover" />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}

                          {/* Display community posts linked to this spot */}
                          {communityReviews.map((rev) => (
                             <div 
                              key={rev.id} 
                              onClick={() => navigate(`/community?postId=${rev.id}`)}
                              className="p-4 rounded-[24px] bg-accent-orange/5 dark:bg-accent-orange/10 border border-accent-orange/20 shadow-sm flex flex-col gap-3 cursor-pointer hover:bg-accent-orange/10 transition-colors relative"
                            >
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full overflow-hidden bg-black/5">
                                     {rev.userAvatar ? (
                                       <img src={rev.userAvatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                     ) : (
                                       <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-text-muted">
                                         {rev.userName?.slice(0, 2).toUpperCase()}
                                       </div>
                                     )}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[11px] font-black dark:text-white leading-tight">
                                      {rev.userName?.startsWith('@') ? rev.userName : (rev.userName || 'Anonymous')}
                                    </span>
                                    <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest">
                                      Community Post • {formatDate(rev.timestamp)}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 bg-accent-orange/10 px-2 py-0.5 rounded-full">
                                  <Star className="w-3 h-3 fill-accent-orange text-accent-orange" />
                                  <span className="text-[10px] font-black text-accent-orange">{rev.rating || 5}.0</span>
                                </div>
                              </div>
                              <p className="text-[11px] text-text-main dark:text-neutral-300 leading-relaxed pl-1">
                                {rev.caption}
                              </p>
                              {rev.imageUrl && (
                                <div 
                                  className="w-full h-32 rounded-xl overflow-hidden shadow-sm border border-black/5"
                                  onClick={(e) => { e.stopPropagation(); setLightboxImage(rev.imageUrl!); }}
                                >
                                  <img src={rev.imageUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                    </div>
                  </div>
                  ) : panelLayer === 1 ? (
                    /* LAYER 1: OVERVIEW */
                    <div className="w-full h-full flex-shrink-0 flex flex-col min-h-0 px-1">
                      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-2">
                        {/* Smaller Image */}
                        <div className="relative group w-full aspect-[2/1] rounded-2xl overflow-hidden shadow-sm mb-3 bg-black/5 shrink-0 cursor-zoom-in">
                          <img
                            src={(selectedSpot.images && selectedSpot.images.length > 0 ? selectedSpot.images[0] : selectedSpot.image) || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1000"}
                            alt=""
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                            referrerPolicy="no-referrer"
                            onClick={() => setLightboxImage((selectedSpot.images && selectedSpot.images.length > 0 ? selectedSpot.images[0] : selectedSpot.image) || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1000")}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1000";
                            }}
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="inline-block px-2 py-0.5 bg-accent-orange/10 dark:bg-white/[0.08] text-[8px] font-black text-accent-orange dark:text-[#FFD6B8] uppercase tracking-[0.1em] rounded-full">
                              {selectedSpot.category}
                            </span>
                            {(() => {
                              const avg = calculateAverageRating(selectedSpot, communityReviews);
                              return avg > 0 ? (
                                <div className="flex items-center gap-1 shrink-0 bg-accent-orange/10 px-2 py-0.5 rounded-full">
                                  <Star className="w-3 h-3 fill-accent-orange text-accent-orange" />
                                  <span className="text-[10px] font-black text-accent-orange">{avg}</span>
                                </div>
                              ) : null;
                            })()}
                          </div>
                          
                          {isEditingName ? (
                            <div className="flex items-center gap-2 pr-1">
                              <input
                                value={editedName}
                                onChange={(e) => setEditedName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                                className="flex-1 bg-black/5 dark:bg-white/10 text-sm p-2 rounded-xl border border-accent-orange outline-none font-bold"
                                autoFocus
                              />
                              <button onClick={handleSaveName} className="p-2 text-green-500 hover:bg-green-500/10 rounded-full transition-colors">
                                <Save className="w-5 h-5" />
                              </button>
                              <button onClick={() => setIsEditingName(false)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-full transition-colors">
                                <X className="w-5 h-5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between group">
                              <h3 className="text-lg leading-tight dark:text-white" style={{ fontFamily: FONT_CHANGA }}>{selectedSpot.name}</h3>
                              <button 
                                onClick={() => setIsEditingName(true)} 
                                className="p-1.5 opacity-0 group-hover:opacity-100 transition-all text-accent-orange hover:bg-accent-orange/10 rounded-lg active:scale-90"
                                title="Edit spot name"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                          
                        <p className="text-[10px] font-medium text-text-muted dark:text-[#FFD6B8] flex items-start gap-1.5 leading-tight mb-3">
                          <MapPin className="w-3 h-3 shrink-0 text-accent-orange" />
                          {selectedSpot.address}
                        </p>

                        <div className="flex items-center gap-4 py-2 border-y border-black/5 dark:border-white/5">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-2.5 h-2.5 text-accent-orange" />
                            <span className="text-[9px] font-bold dark:text-[#F6D8C8] whitespace-nowrap">{selectedSpot.openingHour} - {selectedSpot.closingHour}</span>
                          </div>
                          <div className="flex items-center gap-1.5 border-l border-black/5 dark:border-white/5 pl-4">
                            <Coins className="w-2.5 h-2.5 text-green-500" />
                            <span className="text-[9px] font-bold text-green-600 dark:text-green-400">{selectedSpot.priceRange}</span>
                            <span className="text-[8px] font-black opacity-40 dark:text-[#FFD6B8]">
                              {selectedSpot.priceRange === "$" ? "Low" :
                               selectedSpot.priceRange === "$$" ? "Med" :
                               selectedSpot.priceRange === "$$$" ? "High" : "Lux"}
                            </span>
                          </div>
                        </div>

                        <div className="p-4 bg-accent-pink/5 dark:bg-accent-pink/10 rounded-[24px] border border-accent-pink/20 space-y-2 mt-4 transition-all hover:bg-accent-pink/10">
                          <div className="flex items-center gap-2">
                             <Sparkles className="w-3.5 h-3.5 text-accent-pink" />
                             <span className="text-[10px] font-display font-medium uppercase tracking-widest text-contrast-rose dark:text-accent-pink">Date Suitability</span>
                          </div>
                          <p className="text-[11px] font-sans font-medium text-text-muted leading-relaxed">
                            Perfect for <span className="text-contrast-rose dark:text-accent-pink font-bold">meaningful conversation</span>. The lighting is soft and the noise level is consistently low.
                          </p>
                        </div>

                          <div className="pt-4 flex flex-col gap-2">
                            <div className="flex gap-2">
                            <button
                              onClick={() => {
                                const planData = {
                                  title: selectedSpot.name,
                                  placeName: selectedSpot.name,
                                  address: selectedSpot.address,
                                  notes: selectedSpot.review || 'Check this out on the map!',
                                  budget: selectedSpot.priceRange || '',
                                  placeId: selectedSpot.id
                                };
                                navigate('/planner', { state: { incomingPlan: planData } });
                              }}
                              className="flex-1 py-2.5 bg-accent-orange text-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-md shadow-accent-orange/20 transition-all active:scale-95"
                              style={{ fontFamily: FONT_CHANGA }}
                            >
                              Add to Planner
                            </button>
                            <button
                              onClick={() => toggleDirection(selectedSpot)}
                              className={`flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all active:scale-95 ${
                                routeSpotId === selectedSpot.id
                                  ? "bg-red-500 text-white"
                                  : "bg-black/5 dark:bg-white/10 text-text-main dark:text-white"
                              }`}
                              style={{ fontFamily: FONT_CHANGA }}
                            >
                              {routeSpotId === selectedSpot.id ? "Stop" : "Get Direction"}
                            </button>
                          </div>
                        </div>
                      </div>
                      </div>
                    </div>
                  ) : (
                    /* LAYER 2: MENU */
                    <div className="w-full h-full flex flex-col min-h-0 px-1 overflow-y-auto no-scrollbar">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.1em] text-accent-orange">Upload Menu / Drink List</h4>
                        <label className={`p-1.5 px-4 rounded-full transition-all text-[9px] font-black uppercase tracking-widest cursor-pointer shadow-sm flex items-center gap-2 ${isSubmitting ? 'bg-black/10 text-text-muted cursor-not-allowed' : 'bg-accent-orange/10 text-accent-orange hover:bg-accent-orange hover:text-white'}`}>
                          {isSubmitting ? (
                            <>
                              <div className="w-2 h-2 rounded-full bg-accent-orange animate-pulse" />
                              <span>Uploading...</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-3 h-3" />
                              <span>Browse Local</span>
                            </>
                          )}
                          <input 
                            type="file" 
                            multiple
                            accept="image/*"
                            disabled={isSubmitting}
                            className="hidden" 
                            onChange={async (e) => {
                              const files = Array.from(e.target.files || []);
                              if (files.length > 0) {
                                console.log(`[MENU_UPLOAD] Selected ${files.length} total files`);
                                setIsSubmitting(true);
                                try {
                                  // Compress and convert to base64
                                  const base64s = await Promise.all(
                                    files.map(async (file) => {
                                      console.log(`[MENU_UPLOAD] Processing: ${file.name} (Original: ${Math.round(file.size/1024)}KB)`);
                                      const base64 = await toBase64(file);
                                      // Using quality 0.5 for menu items to save extreme amount of space
                                      const compressed = await compressImage(base64, 1200, 1200, 0.5);
                                      return compressed;
                                    })
                                  );

                                  const currentMenu = selectedSpot?.menu || [];
                                  const updatedMenu = [...currentMenu, ...base64s];
                                  
                                  // Total size check for Firestore document (1MB limit)
                                  const estimatedSize = JSON.stringify(updatedMenu).length;
                                  console.log(`[MENU_UPLOAD] New menu item count: ${updatedMenu.length}. Est document size for images: ${Math.round(estimatedSize/1024)}KB`);
                                  
                                  if (estimatedSize > 850000) { // Safety margin for 1MB limit
                                    throw new Error("Total menu images too large for this spot. Try removing old ones first.");
                                  }

                                  if (selectedSpot) {
                                    await updateSharedSpot(selectedSpot.id, { menu: updatedMenu });
                                    setSelectedSpot({ ...selectedSpot, menu: updatedMenu });
                                    setToast({ message: "Menu updated successfully!", type: "success" });
                                  }
                                } catch (err) {
                                  const errorMessage = err instanceof Error ? err.message : "Failed to upload menu.";
                                  console.error("[MENU_UPLOAD] Error:", err);
                                  setToast({ message: errorMessage, type: "error" });
                                } finally {
                                  setIsSubmitting(false);
                                  e.target.value = '';
                                }
                              }
                            }}
                          />
                        </label>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pb-6">
                        {(selectedSpot.menu && selectedSpot.menu.length > 0) ? (
                          selectedSpot.menu.map((img, idx) => (
                            <div 
                              key={idx} 
                              className="relative group aspect-square rounded-2xl overflow-hidden border border-black/5 dark:border-white/5 cursor-zoom-in shadow-md bg-black/5"
                              onClick={() => setLightboxImage(img)}
                            >
                               <img src={img} alt="Menu Item" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                               <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                 <BookOpen className="w-6 h-6 text-white" />
                               </div>
                               <button
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   const updatedMenu = selectedSpot.menu!.filter((_, i) => i !== idx);
                                   updateSharedSpot(selectedSpot.id, { menu: updatedMenu });
                                   setSelectedSpot({ ...selectedSpot, menu: updatedMenu });
                                 }}
                                 className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-md"
                               >
                                 <Trash2 className="w-3.5 h-3.5" />
                               </button>
                            </div>
                          ))
                        ) : (
                          <div className="col-span-2 py-16 flex flex-col items-center justify-center bg-black/5 dark:bg-white/5 rounded-[32px] border-2 border-dashed border-black/10 dark:border-white/10">
                            <BookOpen className="w-10 h-10 text-text-muted opacity-20 mb-3" />
                            <span className="text-[11px] font-black text-text-muted uppercase tracking-widest text-center px-6">
                              No menu photos yet.<br/>Upload yours to help others.
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Success Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 20, x: "-50%" }}
            className="fixed bottom-24 left-1/2 z-[1000] px-6 py-4 bg-white dark:bg-surface-dark rounded-[24px] shadow-2xl border border-black/5 dark:border-white/10 flex items-center gap-4 min-w-[320px]"
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${toast.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
              {toast.type === 'success' ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
            </div>
            <p className="text-sm font-bold text-text-main dark:text-white pr-4">{toast.message}</p>
            <button onClick={() => setToast(null)} className="ml-auto text-text-muted hover:text-text-main transition-colors">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 py-8 overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
              onClick={() => setIsAddModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="relative w-full max-w-xl bg-white dark:bg-neutral-900 shadow-2xl rounded-[40px] flex flex-col max-h-full overflow-hidden border border-white/20"
            >
              <div className="px-8 pt-8 pb-6 border-b border-black/5 dark:border-white/5 shrink-0">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-3xl font-bold tracking-tight" style={{ fontFamily: FONT_CHANGA }}>Add New Spot</h3>
                    <p className="text-xs text-text-muted font-medium">Pin a special place to share with others</p>
                  </div>
                  <button
                    onClick={() => setIsAddModalOpen(false)}
                    className="p-3 bg-black/5 dark:bg-white/5 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 pt-6 space-y-8 custom-scrollbar">
                <form id="add-spot-form" onSubmit={handleAddSpot} className="space-y-8 pb-4">
                  <div className="space-y-4 mb-10">
                    <label className="text-[11px] font-black uppercase tracking-[0.2em] text-accent-orange px-1">
                      1. Choose a Category
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {MAIN_CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setFormCategory(cat)}
                          className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${formCategory === cat ? "bg-accent-orange/10 border-accent-orange/40 text-accent-orange" : "bg-black/5 dark:bg-white/5 border-transparent"}`}
                        >
                          <img
                            src={CATEGORY_ICON_MAP[cat] || ALL_ICONS[0]}
                            alt=""
                            className="w-7 h-7 object-contain shrink-0"
                          />
                          <span className="text-[11px] font-bold uppercase tracking-wider">{cat}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3 mb-10">
                    <label className="text-[11px] font-black uppercase tracking-[0.2em] text-accent-orange px-1">
                      2. Spot Name
                    </label>
                    <input
                      required
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. Secret Garden Cafe"
                      className="w-full px-6 py-4 bg-black/5 dark:bg-white/5 rounded-2xl outline-none focus:ring-2 focus:ring-accent-orange/20 border border-transparent focus:border-accent-orange/30 transition-all font-semibold text-sm"
                    />
                  </div>

                    <div className="space-y-4 mb-10">
                      <label className="text-[11px] font-black uppercase tracking-[0.2em] text-accent-orange px-1">
                        3. Location Details
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsHidingModalForPin(true);
                          setIsAddModalOpen(false);
                        }}
                        className={`w-full py-4 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all ${newSpotCoords ? "border-green-500/50 bg-green-500/5 text-green-600" : "border-accent-orange/40 bg-accent-orange/5 text-accent-orange hover:bg-accent-orange/10"}`}
                      >
                        <MapPin className="w-6 h-6" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">
                          {newSpotCoords ? "Custom Location Pinned ✓" : "Tap Map to Pinepoint (Optional)"}
                        </span>
                      </button>
                                      <div className="relative">
                        <input
                          required
                          type="text"
                          value={formAddress}
                          onChange={(e) => {
                            setFormAddress(e.target.value);
                            setGeocodingStatus("idle");
                          }}
                          onBlur={() => {
                            setTimeout(() => setAddressSuggestions([]), 200);
                          }}
                          placeholder="Or type address here..."
                          className="w-full px-6 py-4 bg-black/5 dark:bg-white/5 rounded-2xl outline-none focus:ring-2 focus:ring-accent-orange/20 border border-transparent focus:border-accent-orange/30 transition-all font-semibold text-sm"
                        />
                        
                        <AnimatePresence>
                          {addressSuggestions.length > 0 && (
                            <motion.div
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl border border-black/5 dark:border-white/10 z-[3000] overflow-hidden"
                            >
                              {addressSuggestions.map((s: { center: [number, number], place_name: string, properties?: { address?: string }, context?: { id: string, text: string }[] }, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onMouseDown={() => {
                                    const [lon, lat] = s.center;
                                    if (isNaN(lat) || isNaN(lon)) return;
                                    setFormAddress(s.place_name);
                                    setNewSpotCoords([lat, lon]);
                                    safeSetFlyToCoords([lat, lon]);
                                    setGeocodingStatus("success");
                                    setAddressSuggestions([]);
                                    
                                    // Extract district if possible from OSM context/place_name or trigger reverse geocode to get details
                                    if (s.context) {
                                      const districtNode = s.context.find(c => c.id.includes('neighborhood') || c.id.includes('suburb') || c.id.includes('locality'));
                                      if (districtNode) setFormDistrict(districtNode.text);
                                    }
                                  }}
                                  className="w-full text-left px-5 py-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors border-b border-black/5 dark:border-white/5 last:border-0"
                                >
                                  <p className="text-xs font-bold truncate dark:text-white">{s.place_name}</p>
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="space-y-1.5 px-1 pt-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-text-muted opacity-60">District / Area</label>
                        <input
                          type="text"
                          value={formDistrict || ""}
                          onChange={(e) => setFormDistrict(e.target.value)}
                          placeholder="Detected automatically or type here..."
                          className="w-full px-5 py-3 bg-black/5 dark:bg-white/5 rounded-xl outline-none focus:ring-1 focus:ring-accent-orange/20 border border-transparent focus:border-accent-orange/30 transition-all font-bold text-xs"
                        />
                      </div>
                      {geocodingStatus === "loading" && <p className="text-[10px] text-accent-orange animate-pulse px-1">Updating map...</p>}
                      {geocodingStatus === "error" && <p className="text-[10px] text-red-500 font-bold px-1">{geocodingError}</p>}
                    </div>

                  <div className="space-y-3 mb-10">
                    <label className="text-[11px] font-black uppercase tracking-[0.2em] text-accent-orange px-1">
                      4. Spot Cover Photos
                    </label>
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-wrap gap-3">
                          {previewFiles.map((url, idx) => (
                            <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-black/10 group">
                              <img src={url || undefined} alt="" className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => setPreviewFiles(previewFiles.filter((_, i) => i !== idx))}
                                className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ))}
                          <label className="w-20 h-20 rounded-xl border-2 border-dashed border-black/10 dark:border-white/10 flex flex-col items-center justify-center cursor-pointer hover:bg-black/5 transition-all text-text-muted hover:text-accent-orange hover:border-accent-orange/40">
                            <Upload className="w-4 h-4 mb-1" />
                            <span className="text-[9px] font-bold">Upload</span>
                            <span className="text-[7px] opacity-70">({previewFiles.length}/5)</span>
                            <input
                              type="file"
                              multiple
                              className="hidden"
                              accept="image/*"
                              onChange={async (e) => {
                                const files = Array.from(e.target.files || []);
                                if (previewFiles.length + files.length > 5) {
                                  alert("Maximum 5 images allowed.");
                                  return;
                                }
                                try {
                                  const base64s = await Promise.all(
                                    files.map(async (f) => {
                                      const base64 = await toBase64(f);
                                      if (f.type.startsWith('image/')) {
                                        return await compressImage(base64);
                                      }
                                      return base64;
                                    })
                                  );
                                  setPreviewFiles(prev => [...prev, ...base64s]);
                                } catch (err) {
                                  console.error("Error converting files to base64:", err);
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 mb-10">
                    <div className="space-y-3">
                      <label className="text-[11px] font-black uppercase tracking-[0.2em] text-accent-orange px-1 flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5" /> 5. Hours
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={formOpening}
                          onChange={(e) => setFormOpening(e.target.value)}
                          className="flex-1 px-4 py-3 bg-black/5 dark:bg-white/5 rounded-xl outline-none font-bold text-xs"
                        />
                        <span className="text-text-muted text-xs">to</span>
                        <input
                          type="time"
                          value={formClosing}
                          onChange={(e) => setFormClosing(e.target.value)}
                          className="flex-1 px-4 py-3 bg-black/5 dark:bg-white/5 rounded-xl outline-none font-bold text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[11px] font-black uppercase tracking-[0.2em] text-accent-orange px-1 flex items-center gap-2">
                        <Coins className="w-3.5 h-3.5" /> 6. Price Range
                      </label>
                      <div className="space-y-4">
                        <div className="flex gap-2">
                          {[{v: "$", l: "Low"}, {v: "$$", l: "Med"}, {v: "$$$", l: "High"}, {v: "$$$$", l: "Lux"}].map(item => (
                            <button
                              key={item.v}
                              type="button"
                              onClick={() => setFormPrice(item.v)}
                              className={`flex-1 py-1.5 px-1 rounded-xl transition-all border flex flex-col items-center gap-0.5 ${formPrice === item.v ? "bg-accent-orange border-accent-orange text-white shadow-lg shadow-accent-orange/20" : "bg-black/5 dark:bg-white/5 border-transparent text-text-muted hover:bg-black/10"}`}
                            >
                              <span className="text-[10px] font-black tracking-widest">{item.v}</span>
                              <span className="text-[8px] font-bold uppercase opacity-80">{item.l}</span>
                            </button>
                          ))}
                        </div>
                        <div className="space-y-1.5 pt-1">
                          <label className="text-[10px] font-bold text-text-muted px-1">Specific amount (optional)</label>
                          <input
                            type="text"
                            value={formPriceAmount}
                            onChange={(e) => setFormPriceAmount(e.target.value)}
                            placeholder="e.g. around 200k/person"
                            className="w-full px-4 py-2.5 bg-black/5 dark:bg-white/5 rounded-xl outline-none focus:ring-1 focus:ring-accent-orange/20 border border-transparent focus:border-accent-orange/30 transition-all font-semibold text-[11px]"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6 pt-6 border-t border-black/5 dark:border-white/5">
                    <div className="flex items-center justify-between px-1">
                      <label className="text-[11px] font-black uppercase tracking-[0.2em] text-accent-orange flex items-center gap-2">
                        <Star className="w-4 h-4" /> 7. Rating & Review
                      </label>
                    </div>

                    <div className="p-6 bg-black/5 dark:bg-white/5 rounded-[32px] space-y-6 border border-black/5">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-text-muted px-1">Reviewer Name (Optional)</label>
                        <input
                          type="text"
                          value={formReviewName}
                          onChange={(e) => setFormReviewName(e.target.value)}
                          placeholder="Your Name"
                          className="w-full px-5 py-3 bg-white dark:bg-black/20 rounded-2xl outline-none border border-black/5 focus:border-accent-orange/30 transition-all font-bold text-sm"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <label className="text-[10px] font-black uppercase tracking-widest text-text-muted px-1">Overall Rating</label>
                          <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map(star => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => setFormRating(star)}
                                className="focus:outline-none transition-transform hover:scale-110 active:scale-95"
                              >
                                <Star
                                  className={`w-6 h-6 ${star <= formRating ? "fill-yellow-400 text-yellow-400" : "text-text-muted opacity-20"}`}
                                />
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-4">
                          {[
                            { label: "Food", val: formFoodRating, setter: setFormFoodRating },
                            { label: "Service", val: formServiceRating, setter: setFormServiceRating },
                            { label: "Atmosphere", val: formAtmosphereRating, setter: setFormAtmosphereRating }
                          ].map((rating) => (
                            <div key={rating.label} className="flex items-center justify-between gap-4">
                              <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">{rating.label}</span>
                              <div className="flex gap-1.5">
                                {[1, 2, 3, 4, 5].map(star => (
                                  <button
                                    key={star}
                                    type="button"
                                    onClick={() => rating.setter(rating.val === star ? null : star)}
                                    className="focus:outline-none transition-transform hover:scale-110 active:scale-95"
                                  >
                                    <Star
                                      className={`w-3.5 h-3.5 ${rating.val && star <= rating.val ? "fill-accent-orange text-accent-orange" : "text-text-muted opacity-20"}`}
                                    />
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-text-muted px-1">Your detailed experience</label>
                        <textarea
                          value={formReview}
                          onChange={(e) => setFormReview(e.target.value)}
                          placeholder="Let people know about your experience"
                          className="w-full px-5 py-4 bg-white dark:bg-black/20 rounded-2xl outline-none border border-black/5 focus:border-accent-orange/30 transition-all font-semibold text-sm min-h-[120px] resize-none"
                        />
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-text-muted px-1">Review Media (Optional)</label>
                        <div className="flex flex-wrap gap-3">
                          {reviewMediaFiles.map((url, idx) => (
                            <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-black/10 group">
                              {url.startsWith('data:video') || url.includes('video') ? (
                                <video src={url} className="w-full h-full object-cover" />
                              ) : (
                                <img src={url} alt="" className="w-full h-full object-cover" />
                              )}
                              <button
                                type="button"
                                onClick={() => setReviewMediaFiles(reviewMediaFiles.filter((_, i) => i !== idx))}
                                className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ))}
                          <label className="w-16 h-16 rounded-xl border-2 border-dashed border-black/10 dark:border-white/10 flex flex-col items-center justify-center cursor-pointer hover:bg-black/5 transition-all text-text-muted hover:text-accent-orange hover:border-accent-orange/40">
                            <Upload className="w-3.5 h-3.5 mb-0.5" />
                            <span className="text-[8px] font-black uppercase">Browse</span>
                            <input
                              type="file"
                              multiple
                              className="hidden"
                              accept="image/*,video/*"
                              onChange={async (e) => {
                                const files = Array.from(e.target.files || []);
                                try {
                                  const base64s = await Promise.all(
                                    files.map(async (f) => {
                                      const base64 = await toBase64(f);
                                      if (f.type.startsWith('image/')) {
                                        return await compressImage(base64);
                                      }
                                      return base64;
                                    })
                                  );
                                  setReviewMediaFiles(prev => [...prev, ...base64s]);
                                } catch (err) {
                                  console.error("Error converting files:", err);
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-5 bg-accent-orange text-white rounded-[24px] text-sm font-black uppercase tracking-[0.3em] shadow-2xl shadow-accent-orange/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-wait flex items-center justify-center gap-3"
                    >
                      {isSubmitting ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Plus className="w-5 h-5" />
                          Add Spot & Share
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              <div className="p-8 border-t border-black/5 dark:border-white/5 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl shrink-0">
                <div className="flex flex-col gap-3">
                  {isSubmitting && (
                    <p className="text-[10px] text-accent-orange font-bold text-center animate-pulse">
                      Locating address...
                    </p>
                  )}
                  <p className="text-[10px] text-text-muted text-center italic">
                    By sharing, this spot becomes visible to all users.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <DeleteConfirmationModal 
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteSpot}
        isLoading={isSubmitting}
        spotName={spotToDelete?.name || "this spot"}
      />

      {/* Lightbox Modal */}
      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxImage(null)}
            className="fixed inset-0 z-[1000] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm cursor-zoom-out"
          >
            <motion.img
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              src={lightboxImage}
              alt="Preview"
              className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <button 
              onClick={() => setLightboxImage(null)}
              className="absolute top-6 right-6 w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-all"
            >
              <X className="w-6 h-6" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Review Delete Confirmation */}
      <AnimatePresence>
        {reviewToDelete && (
          <div 
            className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => setReviewToDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-neutral-900 w-full max-w-sm rounded-[32px] p-8 shadow-2xl border border-black/5 dark:border-white/5"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-black text-center mb-2 dark:text-white">Delete Review?</h3>
              <p className="text-text-muted text-center mb-8 text-sm leading-relaxed">
                Do you want to delete this review? This action cannot be undone.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setReviewToDelete(null)}
                  className="flex-1 px-4 py-4 bg-black/5 dark:bg-white/5 text-text-main dark:text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-black/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteReview}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-4 bg-red-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-red-500/30 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};