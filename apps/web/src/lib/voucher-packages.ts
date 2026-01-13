export interface VoucherPackage {
  id: string;
  name: string;
  nameAr: string;
  bytes: number;
  priceLE: number;
  profile: string;
  codePrefix: string; // e.g., 'G1' for 1.5GB, 'G3' for 3GB
}

export const VOUCHER_PACKAGES: VoucherPackage[] = [
  {
    id: '1.5GB',
    name: '1.5 GB',
    nameAr: '١.٥ جيجا',
    bytes: 1610612736,
    priceLE: 5,
    profile: 'aboyassen-users',
    codePrefix: 'G1'
  },
  {
    id: '3GB',
    name: '3 GB',
    nameAr: '٣ جيجا',
    bytes: 3221225472,
    priceLE: 10,
    profile: 'aboyassen-users',
    codePrefix: 'G3'
  },
  {
    id: '5GB',
    name: '5 GB',
    nameAr: '٥ جيجا',
    bytes: 5368709120,
    priceLE: 15,
    profile: 'aboyassen-users',
    codePrefix: 'G5'
  },
  {
    id: '10GB',
    name: '10 GB',
    nameAr: '١٠ جيجا',
    bytes: 10737418240,
    priceLE: 30,
    profile: 'aboyassen-users',
    codePrefix: 'G10'
  }
];

export function getPackageById(id: string): VoucherPackage | undefined {
  return VOUCHER_PACKAGES.find(p => p.id === id);
}
