import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  X,
  MapPin,
  Clock,
  Check,
  Edit3,
  Trash2,
  Calendar as CalendarIcon,
  Share2,
  ExternalLink,
  AlertCircle,
  Info,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { DatePlanItem } from '../types';
import { savePlan, deletePlanDoc, addNotification } from '../services/firestore';
import { format, parseISO, isBefore, startOfDay } from 'date-fns';
import { useLocation } from 'react-router-dom';
import { removeVietnameseTones } from '../lib/utils';

const FONT_CHANGA = '"Changa One", cursive';
const FONT_DM_SANS = '"DM Sans", sans-serif';

const STATUS_COLORS = {
  draft: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
  shared: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  confirmed: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  completed: 'bg-accent-orange text-white',
};

export const Planner: React.FC = () => {
  const { plans, currentPlannerDate, setCurrentPlannerDate, user, partnerId, addPlan, updatePlan } = useStore();
  const location = useLocation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Partial<DatePlanItem> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isMounted = React.useRef(true);

  React.useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const [name, setName] = useState('');
  const [time, setTime] = useState('19:00');
  const [endTime, setEndTime] = useState('22:00');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [selectedDate, setSelectedDate] = useState(currentPlannerDate);
  const [incomingData, setIncomingData] = useState<Partial<DatePlanItem> | null>(null);

  useEffect(() => {
    if (location.state?.incomingPlan) {
      const data = location.state.incomingPlan;
      setIncomingData(data);
      setName(data.title || data.placeName || '');
      setAddress(data.address || data.area || '');
      setNote(data.whyThisFits || '');
      setSelectedDate(currentPlannerDate);
      setIsModalOpen(true);

      window.history.replaceState({}, document.title);
    } else {
      // Handle query params for editId and roomId
      const params = new URLSearchParams(location.search);
      const editId = params.get('editId');
      
      if (editId && plans.length > 0) {
        const planToEdit = plans.find(p => p.id === editId);
        if (planToEdit) {
          openEditModal(planToEdit);
          // Only clear params if we successfully found and opened the plan
          const newUrl = window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
        }
      }
    }
  }, [location.state, location.search, plans, currentPlannerDate]);

  const roomIdFromParams = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('roomId');
  }, [location.search]);

  const roomId = useMemo(() => {
    if (editingPlan?._origin === 'shared' && roomIdFromParams) return roomIdFromParams;
    if (!user?.uid || !partnerId) return null;
    return [user.uid, partnerId].sort().join('-');
  }, [user?.uid, partnerId, editingPlan, roomIdFromParams]);

  const dailyPlans = useMemo(() => {
    return plans
      .filter((p) => p.date === currentPlannerDate)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [plans, currentPlannerDate]);

  const openAddModal = () => {
    setEditingPlan(null);
    setIncomingData(null);
    setName('');
    setTime('19:00');
    setEndTime('22:00');
    setAddress('');
    setNote('');
    setSelectedDate(currentPlannerDate);
    setIsModalOpen(true);
  };

  const openEditModal = (plan: DatePlanItem) => {
    setEditingPlan(plan);
    setIncomingData(plan);
    setName(plan.placeName);
    setTime(plan.time);
    setEndTime(plan.endTime || '22:00');
    setAddress(plan.address || plan.area || '');
    setNote(plan.notes || '');
    setSelectedDate(plan.date);
    setIsModalOpen(true);
  };

  const removePlace = async (planId: string, origin?: 'personal' | 'shared') => {
    if (!user?.uid) return;

    try {
      const targetRoomId = origin === 'shared' ? roomId : null;
      await deletePlanDoc(targetRoomId, user.uid, planId);
    } catch (err) {
      console.error('Error removing plan:', err);
    }
  };

  const validateForm = () => {
    if (!name) return 'Please enter a title.';
    if (!selectedDate) return 'Please select a date.';

    const today = startOfDay(new Date());
    const targetDate = parseISO(selectedDate);

    if (isBefore(targetDate, today)) return 'Cannot schedule plans in the past.';
    if (endTime <= time) return 'End time must be after start time.';

    return null;
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();

    const error = validateForm();
    if (error) {
      alert(error);
      return;
    }

    if (!user?.uid) return;

    try {
      setIsSaving(true);
      const planId = editingPlan?.id || Math.random().toString(36).slice(2, 11);

      const normalizedName = removeVietnameseTones(name);
      const normalizedAddress = removeVietnameseTones(address);

      const newPlan: DatePlanItem = {
        id: planId,
        placeId: editingPlan?.placeId || 'manual-' + Date.now(),
        placeName: normalizedName,
        date: selectedDate,
        time,
        endTime,
        notes: note,
        addedBy: editingPlan?.addedBy || user.uid,
        status: editingPlan?.status || 'draft',

        title: normalizedName,
        duration: incomingData?.duration || incomingData?.estimatedDuration || '',
        budget: incomingData?.budget || incomingData?.estimatedBudget || '',
        area: normalizedAddress,
        travelStyle: incomingData?.travelStyle || '',
        tags: incomingData?.tags || [],
        timeline: incomingData?.timeline || [],
        whyThisFits: note || incomingData?.whyThisFits || '',
      };

      const targetRoomId = (editingPlan?._origin === 'shared' || (newPlan.status !== 'draft' && newPlan.status !== 'declined')) ? roomId : null;

      // Optimistic Update
      const optimisticPlan: DatePlanItem = { 
        ...newPlan, 
        _origin: (targetRoomId ? 'shared' : 'personal') as 'personal' | 'shared' | undefined,
        updatedAt: Date.now() // Mock timestamp for local UI
      };

      if (editingPlan) {
        updatePlan(optimisticPlan);
      } else {
        addPlan(optimisticPlan);
      }

      await savePlan(targetRoomId, user.uid, newPlan);

      // Notify partner if it's a shared plan and was updated by either partner
      if (targetRoomId && partnerId && (editingPlan?._origin === 'shared' || newPlan.status === 'shared')) {
        await addNotification(partnerId, {
          userId: partnerId,
          fromUserId: user.uid,
          fromUserName: user.displayName || 'Partner',
          type: 'plan_updated',
          title: 'Plan Updated! ✨',
          message: `${user.displayName || 'Your partner'} updated your shared plan "${newPlan.title}"`,
          data: { planId: newPlan.id, roomId: targetRoomId }
        }).catch(err => console.error('Failed to send update notification:', err));
      }

      if (isMounted.current) {
        setIsModalOpen(false);
        setEditingPlan(null);
      }
    } catch (err) {
      console.error('[Planner] Error saving plan:', err);
      alert('Failed to save plan. Please try again.');
    } finally {
      if (isMounted.current) {
        setIsSaving(false);
      }
    }
  };

  const handleStatusChange = async (
    plan: DatePlanItem,
    newStatus: DatePlanItem['status']
  ) => {
    if (!user?.uid) return;

    try {
      const updated = { ...plan, status: newStatus };

      if (newStatus === 'shared' && plan._origin === 'personal' && roomId) {
        await savePlan(roomId, user.uid, updated);
        await deletePlanDoc(null, user.uid, plan.id);
      } else {
        const targetRoomId = plan._origin === 'shared' ? roomId : null;
        await savePlan(targetRoomId, user.uid, updated);
      }

      // Notify partner if plan is shared
      if (newStatus === 'shared' && roomId && partnerId) {
        await addNotification(partnerId, {
          userId: partnerId,
          fromUserId: user.uid,
          fromUserName: user.displayName || 'Partner',
          type: 'shared_plan',
          title: 'New Plan Shared! 🎁',
          message: `${user.displayName || 'Your partner'} shared a new plan: "${plan.placeName}"`,
          data: { planId: plan.id, roomId: roomId }
        }).catch(err => console.error('Failed to send shared plan notification:', err));
      }
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackPlan, setFeedbackPlan] = useState<DatePlanItem | null>(null);
  const [vibeMatched, setVibeMatched] = useState<'yes' | 'no' | 'better'>('yes');
  const [actualBudget, setActualBudget] = useState('');
  const [feedbackText, setFeedbackText] = useState('');

  const openFeedbackModal = (plan: DatePlanItem) => {
    setFeedbackPlan(plan);
    setVibeMatched('yes');
    setActualBudget(plan.budget || '');
    setFeedbackText('');
    setIsFeedbackModalOpen(true);
  };

  const handleCompleteDate = async () => {
    if (!user?.uid || !feedbackPlan) return;

    try {
      const updated: DatePlanItem = {
        ...feedbackPlan,
        status: 'completed',
        feedback: {
          vibeMatched,
          actualBudget,
          comment: feedbackText,
          completedAt: Date.now(),
        },
      };

      await savePlan(roomId, user.uid, updated);
      setIsFeedbackModalOpen(false);
    } catch (err) {
      console.error('Error completing date:', err);
    }
  };

  const displayDate = useMemo(() => {
    try {
      return format(parseISO(currentPlannerDate), 'EEEE, MMMM do');
    } catch {
      return currentPlannerDate;
    }
  }, [currentPlannerDate]);

  return (
    <div
      className={`min-h-screen font-sans selection:bg-accent-orange selection:text-white bg-[#FDFCFB] dark:bg-neutral-950 ${
        isModalOpen ? 'overflow-hidden' : ''
      }`}
    >
      <div className="max-w-[800px] mx-auto w-full px-6 pt-12 pb-32">
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h1
              className="text-[24px] leading-[1.05] tracking-tight text-text"
              style={{ fontFamily: FONT_CHANGA }}
            >
              Date Planner
            </h1>
            <p
              className="text-[11px] text-text-muted font-medium"
              style={{ fontFamily: FONT_DM_SANS }}
            >
              Design your perfect day, then share it with your partner.
            </p>
          </div>

          <div className="bg-white dark:bg-neutral-900 rounded-[24px] p-3 border border-black/5 shadow-sm">
            <label className="block text-center cursor-pointer">
              <p
                className="text-[9px] font-black uppercase tracking-widest text-accent-orange mb-1"
                style={{ fontFamily: FONT_CHANGA }}
              >
                Viewing
              </p>

              <p className="text-sm font-bold dark:text-white whitespace-nowrap mb-2">
                {displayDate}
              </p>

              <input
                type="date"
                value={currentPlannerDate}
                onChange={(e) => setCurrentPlannerDate(e.target.value)}
                className="bg-transparent text-sm font-bold outline-none cursor-pointer text-text-primary-light dark:text-white"
              />
            </label>
          </div>
        </div>

        <div className="space-y-8">
          <AnimatePresence mode="popLayout">
            {dailyPlans.length > 0 ? (
              dailyPlans.map((plan) => (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white dark:bg-neutral-900 rounded-[40px] border border-black/5 dark:border-white/5 shadow-sm overflow-hidden flex flex-col"
                >
                  <div className="p-8 md:p-10 border-b border-black/10 dark:border-white/10">
                    <div className="flex flex-col md:flex-row justify-between gap-6">
                      <div className="space-y-4 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <span
                            className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                              STATUS_COLORS[plan.status]
                            }`}
                          >
                            {plan.status}
                          </span>

                          <div className="flex items-center gap-2 text-text-primary-light dark:text-text-primary-dark text-xs font-black font-sans opacity-80">
                            <Clock className="w-4 h-4 text-accent-orange" />
                            {plan.time} — {plan.endTime || '...'}
                          </div>

                          {plan.budget && (
                            <span className="px-3 py-1 bg-black/5 dark:bg-white/5 rounded-lg text-[10px] font-black text-text-muted uppercase tracking-tight">
                              {plan.budget}
                            </span>
                          )}
                        </div>

                        <h2 className="text-4xl font-display font-medium text-text-primary-light dark:text-white leading-tight">
                          {plan.placeName}
                        </h2>

                        {plan.area && (
                          <div className="flex items-center gap-2 text-text-primary-light dark:text-neutral-300 text-sm font-bold opacity-70">
                            <MapPin className="w-4 h-4 text-accent-orange" />
                            {plan.area}
                          </div>
                        )}

                        {plan.tags && plan.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {plan.tags.map((t) => (
                              <span
                                key={t}
                                className="px-3 py-1 bg-accent-orange/10 text-accent-orange text-[9px] font-black uppercase rounded-md tracking-wider border border-accent-orange/20"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex md:flex-col gap-3 shrink-0 relative z-20">
                        {(() => {
                          const isCreator = plan.addedBy === user?.uid;
                          const canEdit = isCreator || plan.status === 'accepted' || plan.status === 'confirmed';
                          const canComplete = plan.status === 'accepted' || plan.status === 'confirmed';

                          return (
                            <>
                              {canEdit && plan.status !== 'completed' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditModal(plan);
                                  }}
                                  className="p-4 rounded-3xl bg-neutral-100 dark:bg-neutral-800 text-text hover:bg-neutral-200 transition-all flex items-center justify-center gap-2 relative z-30 pointer-events-auto"
                                >
                                  <Edit3 className="w-5 h-5" />
                                </button>
                              )}

                              {isCreator && plan.status !== 'completed' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removePlace(plan.id, plan._origin);
                                  }}
                                  className="p-4 rounded-3xl bg-neutral-100 dark:bg-neutral-800 text-text hover:bg-neutral-200 hover:text-red-500 transition-all flex items-center justify-center gap-2 relative z-30 pointer-events-auto"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              )}

                              {canComplete && plan.status !== 'completed' && (
                                <button
                                  type="button"
                                  onClick={() => openFeedbackModal(plan)}
                                  className="px-6 py-4 rounded-3xl bg-black text-white font-bold text-sm tracking-widest flex items-center justify-center gap-2 hover:scale-[1.02] shadow-lg shadow-black/20 transition-all relative z-30"
                                >
                                  <Check className="w-5 h-5 text-accent-orange" />
                                  COMPLETE
                                </button>
                              )}

                              {plan.status === 'draft' && partnerId && (
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(plan, 'shared')}
                                  className="px-6 py-4 rounded-3xl bg-accent-orange text-white font-bold text-sm tracking-widest flex items-center justify-center gap-2 hover:scale-[1.02] shadow-lg shadow-accent-orange/20 transition-all relative z-30"
                                >
                                  <Share2 className="w-5 h-5" />
                                  SHARE
                                </button>
                              )}

                              {plan.status === 'shared' && isCreator && partnerId && (
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(plan, 'confirmed')}
                                  className="px-6 py-4 rounded-3xl bg-green-500 text-white font-bold text-sm tracking-widest flex items-center justify-center gap-2 hover:scale-[1.02] shadow-lg shadow-green-500/20 transition-all relative z-30"
                                >
                                  <Check className="w-5 h-5" />
                                  CONFIRM
                                </button>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    {plan.whyThisFits && (
                      <div className="mt-8 p-6 bg-accent-orange/[0.05] border-l-4 border-accent-orange rounded-r-3xl">
                        <p className="text-sm italic font-bold text-text-primary-light dark:text-neutral-200 leading-relaxed opacity-90">
                          "{plan.whyThisFits}"
                        </p>
                      </div>
                    )}
                  </div>

                  {plan.timeline && plan.timeline.length > 0 && (
                    <div className="p-8 md:p-10 bg-neutral-50/50 dark:bg-neutral-800/20 space-y-8">
                      <h3 className="text-xl font-bold font-display opacity-40 uppercase tracking-widest">
                        Planned Stops
                      </h3>

                      <div className="space-y-6 relative">
                        <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-neutral-200 dark:bg-neutral-700" />

                        {plan.timeline.map((stop, sIdx) => (
                          <div key={sIdx} className="relative pl-12 space-y-4">
                            <div className="absolute left-0 top-1 w-10 h-10 rounded-full bg-white dark:bg-neutral-900 border-2 border-accent-orange flex items-center justify-center z-10 shadow-sm">
                              <span className="text-[10px] font-black text-accent-orange">
                                {sIdx + 1}
                              </span>
                            </div>

                            <div className="flex flex-col md:flex-row justify-between gap-4">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-black text-accent-orange tracking-widest">
                                    {stop.time}
                                  </span>
                                  <span className="w-1 h-1 bg-neutral-300 rounded-full" />
                                  <span className="text-xs font-bold text-text-muted">
                                    {stop.purpose}
                                  </span>
                                </div>

                                <h4 className="text-xl font-bold font-display">
                                  {stop.placeName}
                                </h4>

                                <p className="text-[11px] text-text-muted mt-0.5 flex items-center gap-1">
                                  <MapPin className="w-3 h-3" /> {stop.address}
                                </p>
                              </div>

                              <div className="flex gap-2 h-fit">
                                <button
                                  type="button"
                                  className="p-3 bg-white dark:bg-neutral-800 border border-black/5 rounded-2xl flex items-center justify-center hover:bg-neutral-50 transition-all"
                                >
                                  <MapPin className="w-4 h-4 text-accent-orange" />
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              <div className="space-y-3">
                                <p className="text-xs font-medium text-text opacity-70 leading-relaxed">
                                  {stop.whyItFits}
                                </p>

                                {stop.backupPlace && (
                                  <div className="p-3 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5">
                                    <p className="text-[9px] font-black text-accent-pink uppercase tracking-widest mb-1 flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3" /> Backup
                                    </p>
                                    <p className="text-[11px] font-bold">
                                      {stop.backupPlace.name}
                                    </p>
                                    <p className="text-[10px] text-text-muted italic">
                                      "{stop.backupPlace.why}"
                                    </p>
                                  </div>
                                )}
                              </div>

                              <div className="space-y-3">
                                {stop.socialReviews && stop.socialReviews.length > 0 ? (
                                  <div className="space-y-2">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">
                                      Social Reviews
                                    </p>

                                    <div className="flex flex-wrap gap-2">
                                      {stop.socialReviews.map((sr, rIdx) => (
                                        <a
                                          key={rIdx}
                                          href={sr.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-2 p-2 bg-white dark:bg-neutral-800 border border-black/5 rounded-xl hover:scale-105 transition-all"
                                        >
                                          <ExternalLink className="w-3 h-3 text-accent-orange" />
                                          <span className="text-[10px] font-bold uppercase tracking-tighter opacity-70">
                                            {sr.platform}
                                          </span>
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-[10px] text-text-muted italic px-2">
                                    No social reviews added yet.
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-32 flex flex-col items-center justify-center text-center space-y-6"
              >
                <div className="w-24 h-24 bg-accent-orange/5 rounded-[40px] flex items-center justify-center">
                  <CalendarIcon className="w-10 h-10 text-accent-orange/30" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-display font-medium text-text">
                    No plans for this day
                  </h3>
                  <p className="text-text-muted max-w-[280px] text-sm">
                    Use the Discover tab to find inspiration or add a custom idea below.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={openAddModal}
                  className="px-8 py-4 bg-black text-white rounded-2xl font-bold text-sm tracking-widest hover:scale-105 transition-all"
                >
                  CREATE NEW PLAN
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={openAddModal}
          className="fixed bottom-10 right-10 w-20 h-20 bg-accent-orange text-white rounded-[32px] flex items-center justify-center shadow-2xl shadow-accent-orange/40 z-40"
        >
          <Plus className="w-10 h-10 stroke-[3]" />
        </motion.button>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[#FDFCFB] dark:bg-neutral-900 w-full max-w-2xl max-h-[90vh] rounded-[48px] overflow-hidden relative z-[110] shadow-2xl flex flex-col"
            >
              <div className="p-8 border-b border-black/5 flex justify-between items-center bg-white dark:bg-neutral-900">
                <h2 className="text-3xl font-display font-medium tracking-tight text-text">
                  {editingPlan ? 'Refine Plan' : 'Add to Schedule'}
                </h2>

                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-full hover:rotate-90 transition-all"
                >
                  <X className="w-5 h-5 text-text-muted" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 bg-neutral-50/30 dark:bg-white/[0.02]">
                <form onSubmit={handleSavePlan} className="space-y-8 pb-10">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-text-muted px-2">
                      Date Title / Location
                    </label>

                    <input
                      required
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Sunset Coffee at District 2"
                      className="w-full bg-white dark:bg-neutral-800 border-2 border-black/5 rounded-[24px] py-5 px-6 text-base font-bold focus:border-accent-orange outline-none transition-all dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-text-muted px-2">
                        Date
                      </label>

                      <input
                        required
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full bg-white dark:bg-neutral-800 border-2 border-black/5 rounded-[24px] py-5 px-6 text-sm font-bold focus:border-accent-orange outline-none dark:text-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-text-muted px-2">
                          Start
                        </label>

                        <input
                          required
                          type="time"
                          value={time}
                          onChange={(e) => setTime(e.target.value)}
                          className="w-full bg-white dark:bg-neutral-800 border-2 border-black/5 rounded-[24px] py-5 px-6 text-sm font-bold focus:border-accent-orange outline-none dark:text-white"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-text-muted px-2">
                          End
                        </label>

                        <input
                          required
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="w-full bg-white dark:bg-neutral-800 border-2 border-black/5 rounded-[24px] py-5 px-6 text-sm font-bold focus:border-accent-orange outline-none dark:text-white"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-text-muted px-2">
                      Area / Address
                    </label>

                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="e.g. Thao Dien, District 2"
                      className="w-full bg-white dark:bg-neutral-800 border-2 border-black/5 rounded-[24px] py-5 px-6 text-base font-bold focus:border-accent-orange outline-none transition-all dark:text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-text-muted px-2">
                      Note / Why this fits
                    </label>

                    <textarea
                      rows={4}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Why did you choose this? Any special notes?"
                      className="w-full bg-white dark:bg-neutral-800 border-2 border-black/5 rounded-[24px] py-6 px-7 text-sm font-medium leading-relaxed outline-none focus:border-accent-orange transition-all dark:text-white resize-none"
                    />
                  </div>

                  {incomingData?.timeline && incomingData.timeline.length > 0 && (
                    <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase tracking-widest text-text-muted px-2 flex items-center gap-2">
                        <Info className="w-3 h-3" /> AI Suggestion Preview
                      </label>

                      <div className="bg-black/5 dark:bg-white/5 rounded-[32px] p-6 space-y-4">
                        {incomingData.timeline.map((stop, sIdx) => (
                          <div
                            key={sIdx}
                            className="flex gap-4 items-start pb-4 border-b border-black/5 last:border-0 last:pb-0"
                          >
                            <div className="w-8 h-8 rounded-full bg-white border border-black/5 shrink-0 flex items-center justify-center font-bold text-xs">
                              {sIdx + 1}
                            </div>

                            <div>
                              <p className="text-xs font-bold">{stop.placeName}</p>
                              <p className="text-[10px] text-text-muted line-clamp-1">
                                {stop.purpose}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full bg-black text-white py-6 rounded-[24px] font-display text-lg tracking-[0.2em] shadow-2xl transition-all flex items-center justify-center gap-3 hover:scale-[1.01] disabled:opacity-50"
                  >
                    {isSaving ? (
                      <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Check className="w-6 h-6 text-accent-orange" />
                    )}
                    <span>{isSaving ? 'PLANNING...' : 'LOCKED IN'}</span>
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isFeedbackModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFeedbackModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="bg-white dark:bg-neutral-900 w-full max-w-md rounded-[48px] overflow-hidden relative z-[130] shadow-2xl p-10 space-y-8"
            >
              <div className="space-y-2 text-center">
                <h3
                  className="text-3xl font-display font-medium"
                  style={{ fontFamily: FONT_CHANGA }}
                >
                  How was it?
                </h3>

                <p className="text-text-muted text-sm px-4">
                  Help us refine your future date suggestions by reflecting on this
                  experience.
                </p>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-text-muted px-2">
                    Matched expectations?
                  </label>

                  <div className="grid grid-cols-3 gap-3">
                    {(['no', 'yes', 'better'] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setVibeMatched(v)}
                        className={`py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          vibeMatched === v
                            ? 'bg-accent-orange text-white shadow-lg shadow-accent-orange/20'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-text-muted opacity-50'
                        }`}
                      >
                        {v === 'better' ? 'Beyond!' : v}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-text-muted px-2">
                    Actual Budget Used
                  </label>

                  <input
                    type="text"
                    value={actualBudget}
                    onChange={(e) => setActualBudget(e.target.value)}
                    placeholder="e.g. 850k"
                    className="w-full bg-neutral-50 dark:bg-neutral-800 border-2 border-black/5 rounded-[24px] py-5 px-6 text-base font-bold dark:text-white focus:border-accent-orange outline-none transition-all"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-text-muted px-2">
                    Quick Highlight
                  </label>

                  <textarea
                    rows={3}
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="What made this special? (Private note)"
                    className="w-full bg-neutral-50 dark:bg-neutral-800 border-2 border-black/5 rounded-[24px] py-5 px-6 text-sm font-bold dark:text-white focus:border-accent-orange outline-none transition-all resize-none"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleCompleteDate}
                className="w-full bg-black text-white py-6 rounded-[24px] font-display text-lg tracking-[0.2em] shadow-2xl transition-all flex items-center justify-center gap-3 hover:scale-[1.02]"
              >
                <Check className="w-6 h-6 text-accent-orange" />
                <span>SAVE MEMORY</span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Planner;