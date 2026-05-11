import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { mockPlaces } from '../data/mockDb';
import { motion } from 'motion/react';
import { Star, MapPin, Clock, Navigation, ChevronLeft, Heart, Share2, Sparkles } from 'lucide-react';

import { useStore } from '../store/useStore';
import { savePlan } from '../services/firestore';
import { DatePlanItem } from '../types';
import { removeVietnameseTones } from '../utils';

export const PlaceDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, savedSpots, toggleSaveSpot } = useStore();
  const place = mockPlaces.find(p => p.id === id);

  const handleAddToPlan = async () => {
    if (!user || !place) return;

    const newPlan: DatePlanItem = {
      id: Math.random().toString(36).slice(2, 11),
      placeId: place.id,
      placeName: place.name,
      date: new Date().toISOString().split('T')[0],
      time: '19:00',
      notes: 'Added from place details',
      addedBy: user.uid,
      status: 'draft'
    };

    try {
      await savePlan(null, user.uid, newPlan);
      navigate('/planner');
    } catch (error) {
      console.error('Failed to add to plan:', error);
    }
  };

  if (!place) {
    return (
      <div className="text-center py-20 space-y-6">
        <h2 className="text-3xl font-bold">Place not found</h2>
        <button onClick={() => navigate('/')} className="text-accent-orange font-bold uppercase tracking-widest">Back to Home</button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-20">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-text-muted hover:text-accent-orange transition-colors font-bold uppercase tracking-widest text-xs"
      >
        <ChevronLeft className="w-4 h-4" /> Back
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Image Gallery */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          <div className="aspect-[4/3] rounded-[56px] overflow-hidden shadow-2xl">
            <img 
              src={place.image || undefined} 
              alt={place.name} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            {place.images.map((img, i) => (
              <div key={i} className="aspect-square rounded-[24px] overflow-hidden glass">
                <img 
                  src={img || undefined} 
                  alt="" 
                  className="w-full h-full object-cover opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
                  referrerPolicy="no-referrer"
                />
              </div>
            ))}
          </div>

          {/* Practical Recommendations */}
          <div className="glass p-8 rounded-[40px] space-y-6">
            <h3 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent-orange" /> Practical Tips
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-accent-orange/10 flex items-center justify-center text-accent-orange shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Best Time to Visit</div>
                  <div className="text-sm font-medium">{place.recommendations.bestTime}</div>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-accent-pink/10 flex items-center justify-center text-accent-pink shrink-0">
                  <Heart className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Perfect For</div>
                  <div className="text-sm font-medium">{place.recommendations.target}</div>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-accent-mint/10 flex items-center justify-center text-accent-mint shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Recommended Vibe/Outfit</div>
                  <div className="text-sm font-medium">{place.recommendations.outfit}</div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Info */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-8"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="px-4 py-2 bg-accent-orange/10 text-accent-orange text-[10px] font-bold rounded-full uppercase tracking-widest">
                {place.category}
              </span>
              <div className="flex gap-4">
                <button 
                  onClick={() => place && toggleSaveSpot(place)}
                  className={`transition-colors ${savedSpots.some(s => s.id === place?.id) ? 'text-accent-pink' : 'text-text-muted hover:text-accent-pink'}`}
                >
                  <Heart className={`w-6 h-6 ${savedSpots.some(s => s.id === place?.id) ? 'fill-current' : ''}`} />
                </button>
                <button className="text-text-muted hover:text-accent-orange transition-colors"><Share2 className="w-6 h-6" /></button>
              </div>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-tight">
              {removeVietnameseTones(place.name)}
            </h1>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-lg font-bold">
                <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                {place.rating}
                <span className="text-text-muted font-medium text-sm">({place.reviews.length}+ reviews)</span>
              </div>
              <div className="text-accent-orange font-bold text-lg">{place.priceRange}</div>
            </div>
          </div>

          <p className="text-text-muted text-lg leading-relaxed">
            {place.description}
          </p>

          <div className="glass p-6 rounded-[32px] border-l-4 border-accent-orange">
            <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">Review Sentiment</div>
            <p className="text-sm font-medium italic">"{place.reviewSentiment}"</p>
          </div>

          <div className="space-y-6 pt-6 border-t border-black/5 dark:border-white/5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-surface-light dark:bg-surface-dark flex items-center justify-center text-accent-orange">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Address</div>
                <div className="font-bold">{place.address}</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-surface-light dark:bg-surface-dark flex items-center justify-center text-accent-orange">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Opening Hours</div>
                <div className="font-bold">{place.openingHours}</div>
              </div>
            </div>
          </div>

          {/* Reviews Snippets */}
          <div className="space-y-6">
            <h3 className="text-xl font-bold tracking-tight">Recent Reviews</h3>
            <div className="space-y-4">
              {place.reviews.map((review, idx) => (
                <div key={idx} className="p-6 bg-surface-light dark:bg-surface-dark rounded-[32px] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-sm">{review.user}</div>
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                      <span className="text-xs font-bold">{review.rating}</span>
                    </div>
                  </div>
                  <p className="text-sm text-text-muted leading-relaxed">{review.text}</p>
                  <div className="text-[10px] text-text-muted font-bold uppercase tracking-widest">{review.date}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 pt-8">
            <a 
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name + ' ' + place.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-3 py-5 bg-accent-orange text-white rounded-[24px] font-bold uppercase tracking-widest shadow-xl shadow-accent-orange/20 hover:scale-105 transition-transform"
            >
              <Navigation className="w-5 h-5" /> Open in Google Maps
            </a>
            <button 
              onClick={handleAddToPlan}
              className="flex-1 flex items-center justify-center gap-3 py-5 bg-surface-light dark:bg-surface-dark rounded-[24px] font-bold uppercase tracking-widest hover:bg-black/5 dark:hover:bg-white/5 transition-all"
            >
              Add to Plan
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
