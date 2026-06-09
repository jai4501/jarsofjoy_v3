type CartItem = any; // items from useCartStore

export interface DeliveryResult {
  fee: number;
  isFree: boolean;
  distanceKm: number;
  weightGrams: number;
  partner: 'Delhivery' | 'Rapido' | 'Self';
  canDeliverAll: boolean;
  unavailableItems: string[];
  reasons: string[];
  isWeekend: boolean;
  isLateNight: boolean;
}

/**
 * Calculates delivery fees and availability based on business rules:
 * 1. Distance > 10km => Delhivery (Items must have can_deliver_far = true)
 * 2. Distance < 10km => Rapido/Self (Same day delivery)
 * 3. Free Delivery Rules for < 10km:
 *    - Weekend AND Weight > 500g => FREE
 *    - Weekday AND Time > 7 PM => FREE
 */
export const calculateDelivery = (
  items: CartItem[],
  distanceKm: number,
  baseFee: number = 40
): DeliveryResult => {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  
  const isWeekend = day === 0 || day === 6;
  const isLateNight = !isWeekend && hour >= 19; // > 7 PM

  // Calculate total weight (parsing variation names like "500g", "1kg")
  let totalWeightGrams = 0;
  items.forEach(item => {
    const qty = item.quantity || 1;
    const variationName = item.variant_name || item.name || '';
    
    const weight = (() => {
      if (variationName.toLowerCase().includes('kg')) {
        return parseFloat(variationName) * 1000;
      } else if (variationName.toLowerCase().includes('g')) {
        return parseFloat(variationName);
      } else {
        // Default to 250g if not specified
        return 250;
      }
    })();
    totalWeightGrams += weight * qty;
  });

  const unavailableItems: string[] = [];
  if (distanceKm > 10) {
    items.forEach(item => {
      // Check if item specifically forbids long distance
      if (item.can_deliver_far === false) {
        unavailableItems.push(item.name);
      }
    });
  }

  let fee = baseFee;
  let isFree = false;
  const reasons: string[] = [];

  if (distanceKm <= 10) {
    if (isWeekend && totalWeightGrams > 500) {
      fee = 0;
      isFree = true;
      reasons.push('Weekend Special: Free delivery above 500g!');
    } else if (isLateNight) {
      fee = 0;
      isFree = true;
      reasons.push('Late Night Perk: Free delivery after 7 PM!');
    }
  } else {
    // Distance > 10km logic
    // Fees might scale with distance for Delhivery, but using base for now
    fee = baseFee + (Math.max(0, distanceKm - 10) * 5); // Example scaling
  }

  return {
    fee,
    isFree,
    distanceKm,
    weightGrams: totalWeightGrams,
    partner: distanceKm > 10 ? 'Delhivery' : 'Rapido',
    canDeliverAll: unavailableItems.length === 0,
    unavailableItems,
    reasons,
    isWeekend,
    isLateNight
  };
};
