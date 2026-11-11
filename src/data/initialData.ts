import { Room, AcademicScheduleSlot, AdHocBooking, InstitutionalBlock } from '../types';

export const INITIAL_ROOMS: Room[] = [
  // Bilik Kuliah (28 rooms: BK01 - BK28)
  ...Array.from({ length: 28 }, (_, i) => {
    const num = i + 1;
    const code = `BK${num < 10 ? '0' + num : num}`;
    const block = 'Bangunan Akademik';
    const level = num <= 9 ? 1 : num <= 15 ? 2 : 3;
    const aircondNums = [1, 2, 3, 4, 5, 6, 7, 8, 9, 20, 21, 22, 23, 24, 25];
    const hasAircond = aircondNums.includes(num);
    
    return {
      id: code,
      code,
      name: code,
      category: 'Bilik Kuliah' as const,
      capacity: 28,
      block,
      level,
      facilities: [
        'Projektor LCD',
        hasAircond ? 'Pendingin Hawa (Aircond)' : 'Kipas Angin / Pengudaraan',
        'Papan Putih',
        'Sistem Bunyi Mikrofon',
        'Capaian Wi-Fi KPMBP'
      ],
      hasAircond,
      isSmartClassroom: false,
      notes: hasAircond ? 'Bilik Kuliah berhawa dingin (Aircond)' : 'Ruang kuliah standard (Kipas Angin)'
    };
  }),

  // Smart Classroom (1 room)
  {
    id: 'SMART_CLASSROOM',
    code: 'S. CLASSROOM',
    name: 'S. CLASSROOM',
    category: 'Bilik Kuliah',
    capacity: 30,
    block: 'Bangunan Akademik',
    level: 'Ground Floor',
    facilities: [
      'Papan Pintar Interaktif (Smartboard)',
      'Pendingin Hawa (Aircond)',
      'Kamera Web HD & Mikrofon Bilik',
      'Sistem Audio Digital',
      'Meja Pembelajaran Kolaboratif',
      'Capaian Wi-Fi KPMBP'
    ],
    hasAircond: true,
    isSmartClassroom: true,
    notes: 'Bilik kuliah pintar dengan fasiliti hibrid dan skrin interaktif'
  },

  // Makmal Komputer (5 labs)
  {
    id: 'MAKMAL_ALFA',
    code: 'LAB ALFA',
    name: 'LAB ALFA',
    category: 'Makmal Komputer',
    capacity: 35,
    block: 'Pusat Komputer & IT',
    level: '1st Floor',
    facilities: ['35x PC Komputer Berprestasi Tinggi', 'Projektor HD & Skrin Bermotor', 'Pendingin Hawa Pusat', 'Rangkaian Gigabit LAN', 'Papan Putih'],
    hasAircond: true,
    notes: 'Makmal komputer utama untuk praktikal pengaturcaraan, perakaunan berkomputer dan peperiksaan online'
  },
  {
    id: 'MAKMAL_BETA',
    code: 'LAB BETA',
    name: 'LAB BETA',
    category: 'Makmal Komputer',
    capacity: 35,
    block: 'Pusat Komputer & IT',
    level: 'Ground Floor',
    facilities: ['35x PC Komputer', 'Projektor HD', 'Pendingin Hawa Pusat', 'Rangkaian Gigabit LAN', 'Papan Putih'],
    hasAircond: true,
    notes: 'Makmal komputer untuk kelas pengkomputeran dan latihan staf'
  },
  {
    id: 'MAKMAL_SIGMA',
    code: 'LAB SIGMA',
    name: 'LAB SIGMA',
    category: 'Makmal Komputer',
    capacity: 35,
    block: 'Pusat Komputer & IT',
    level: 'Ground Floor',
    facilities: ['35x PC Komputer', 'Projektor HD', 'Pendingin Hawa Pusat', 'Rangkaian Gigabit LAN', 'Papan Putih'],
    hasAircond: true,
    notes: 'Makmal komputer multimedia dan sistem maklumat perniagaan'
  },
  {
    id: 'MAKMAL_GAMMA',
    code: 'LAB GAMMA',
    name: 'LAB GAMMA',
    category: 'Makmal Komputer',
    capacity: 35,
    block: 'Pusat Komputer & IT',
    level: '1st Floor',
    facilities: ['35x PC Komputer', 'Projektor HD', 'Pendingin Hawa Pusat', 'Rangkaian Gigabit LAN', 'Papan Putih'],
    hasAircond: true,
    notes: 'Makmal komputer untuk pembangunan perisian dan reka bentuk'
  },
  {
    id: 'MAKMAL_DELTA',
    code: 'LAB DELTA',
    name: 'LAB DELTA',
    category: 'Makmal Komputer',
    capacity: 35,
    block: 'Pusat Komputer & IT',
    level: 2,
    facilities: ['35x PC Komputer', 'Projektor HD', 'Pendingin Hawa Pusat', 'Rangkaian Gigabit LAN', 'Papan Putih'],
    hasAircond: true,
    notes: 'Makmal komputer untuk penyelidikan data dan bengkel teknologi'
  },

  // Dewan Kuliah & Dewan Utama (Di bawah kategori Ruang Khas)
  {
    id: 'DEWAN_BESAR',
    code: 'DEWAN BESAR',
    name: 'Dewan Besar (Dewan Utama)',
    category: 'Ruang Khas',
    capacity: 500,
    block: 'Bangunan Pentadbiran & Dewan Utama',
    level: 'Ground Floor',
    facilities: [
      'Pentas Utama & Tirai Bermotor',
      'Sistem PA Audio Profesional & 4x Wireless Mic',
      'Dual Skrin Projektor LED Besar',
      'Pendingin Hawa Pusat (Central Aircond)',
      'Lampu Sorot & Sistem Pencahayaan Pentas',
      'Bilik Persalinan & Bilik Menunggu VIP',
      'Kapasiti 500 Kerusi'
    ],
    hasAircond: true,
    allowNightBooking: true,
    notes: 'Dewan Utama serbaguna untuk majlis rasmi, seminar kebangsaan, peperiksaan berpusat, taklimat kolej, dan program petang & malam (4pm-11pm)'
  },
  {
    id: 'SRI_PENAWAR',
    code: 'SRI PENAWAR',
    name: 'Dewan Sri Penawar',
    category: 'Ruang Khas',
    capacity: 150,
    block: 'Bangunan Akademik Utama',
    level: 1,
    facilities: [
      'Dual Projektor HD',
      'Sistem Audio Mikrofon Berwayar & Tanpa Wayar',
      'Pendingin Hawa Pusat (Central Aircond)',
      'Meja & Kerusi Susunan Peperiksaan / Seminar',
      'Papan Putih Kaca',
      'Capaian Wi-Fi KPMBP'
    ],
    hasAircond: true,
    allowNightBooking: true,
    notes: 'Dewan serbaguna peperiksaan akhir, kuliah gabungan, dan seminar akademik'
  },
  {
    id: 'DKA',
    code: 'DKA',
    name: 'DKA',
    category: 'Ruang Khas',
    capacity: 120,
    block: 'Bangunan Akademik Utama',
    level: 2,
    facilities: ['Dual Projektor HD', 'Kerusi Bertingkat (Auditorium)', 'Sistem Audio Dewan', 'Pendingin Hawa Pusat', 'Papan Pintar'],
    hasAircond: true,
    allowNightBooking: true,
    notes: 'Sesuai untuk kuliah gabungan kelas besar, ceramah khas, dan taklimat program'
  },
  {
    id: 'DKB',
    code: 'DKB',
    name: 'DKB',
    category: 'Ruang Khas',
    capacity: 120,
    block: 'Bangunan Akademik Utama',
    level: 2,
    facilities: ['Dual Projektor HD', 'Kerusi Bertingkat (Auditorium)', 'Sistem Audio Dewan', 'Pendingin Hawa Pusat'],
    hasAircond: true,
    allowNightBooking: true,
    notes: 'Sesuai untuk peperiksaan, taklimat, dan perkongsian ilmu'
  },

  // Ruang Khas (4 spaces)
  {
    id: 'ARAS_1_PERPUSTAKAAN',
    code: 'L1 LIBRARY',
    name: 'L1 LIBRARY',
    category: 'Ruang Khas',
    capacity: 60,
    block: 'Bangunan Perpustakaan',
    level: 1,
    facilities: ['Zon Pembelajaran Terbuka', 'Pendingin Hawa', 'Meja Perbincangan Kumpulan', 'Capaian Wi-Fi KPMBP', 'Palam Kuasa Komputer Riba'],
    hasAircond: true,
    notes: 'Ruang pembelajaran kolaboratif dan aktiviti literasi maklumat'
  },
  {
    id: 'BILIK_KOTA_TINGGI',
    code: 'BLK. KOTA TINGGI',
    name: 'BLK. KOTA TINGGI',
    category: 'Ruang Khas',
    capacity: 30,
    block: 'Bangunan Pentadbiran',
    level: 2,
    facilities: ['Meja Mesyuarat Eksekutif', 'TV Paparan Pintar 75"', 'Sistem Persidangan Video', 'Pendingin Hawa', 'Papan Tulis Kaca'],
    hasAircond: true,
    notes: 'Bilik mesyuarat utama pengurusan dan perjumpaan rasmi'
  },
  {
    id: 'DEWAN_SEMINAR',
    code: 'DEWAN SEMINAR',
    name: 'DEWAN SEMINAR',
    category: 'Ruang Khas',
    capacity: 80,
    block: 'Bangunan Perpustakaan',
    level: 4,
    facilities: ['Skrin LED Interaktif 85"', 'Susunan Meja Fleksibel', 'Sistem Audio Mikrofon Wireless', 'Pentas Kecil', 'Pendingin Hawa'],
    hasAircond: true,
    notes: 'Pilihan utama bagi wacana akademik, bengkel kepimpinan, dan mesyuarat pengurusan'
  },
  {
    id: 'MINI_SEMINAR',
    code: 'MINI SEMINAR',
    name: 'MINI SEMINAR',
    category: 'Ruang Khas',
    capacity: 30,
    block: 'Bangunan Perpustakaan',
    level: 3,
    facilities: ['Meja Persidangan U-Shape', 'Skrin TV Smart Display 65"', 'Pendingin Hawa', 'Papan Putih Kaca'],
    hasAircond: true,
    notes: 'Direka khas untuk mesyuarat jawatankuasa, pembentangan projek khas, dan bengkel kecil'
  },
  {
    id: 'BILIK_INKUBATOR',
    code: 'BLK. INKUBATOR',
    name: 'Bilik Inkubator',
    category: 'Ruang Khas',
    capacity: 25,
    block: 'Bangunan Pentadbiran & Inovasi',
    level: 'Ground Floor',
    facilities: ['Meja Perbincangan Kumpulan', 'Pendingin Hawa', 'Papan Putih Kaca', 'Wi-Fi Kelajuan Tinggi', 'Palam Kuasa Komputer'],
    hasAircond: true,
    notes: 'Pusat inkubator keusahawanan dan inovasi pelajar/staf'
  },
  {
    id: 'BILIK_MESYUARAT',
    code: 'B. MESYUARAT',
    name: 'Bilik Mesyuarat',
    category: 'Ruang Khas',
    capacity: 25,
    block: 'Bangunan Pentadbiran',
    level: 1,
    facilities: [
      'Meja Mesyuarat Utama',
      'Pendingin Hawa (Aircond)',
      'Smart TV / Skrin Paparan',
      'Sistem Audio Persidangan',
      'Papan Putih Kaca',
      'Capaian Wi-Fi KPMBP'
    ],
    hasAircond: true,
    isSmartClassroom: false,
    notes: 'Bilik mesyuarat rasmi pentadbiran dan perbincangan jabatan'
  },
  {
    id: 'BILIK_GERAKAN',
    code: 'B. GERAKAN',
    name: 'Bilik Gerakan',
    category: 'Ruang Khas',
    capacity: 30,
    block: 'Bangunan Pentadbiran',
    level: 1,
    facilities: [
      'Meja Mesyuarat U-Shape',
      'Pendingin Hawa (Aircond)',
      'Projektor LCD',
      'Papan Putih Kaca',
      'Capaian Wi-Fi KPMBP'
    ],
    hasAircond: true,
    isSmartClassroom: false,
    notes: 'Bilik gerakan operasi dan mesyuarat strategik kolej'
  },

  // Surau (2 surau)
  {
    id: 'SURAU_1',
    code: 'SURAU 1',
    name: 'SURAU 1',
    category: 'Surau',
    capacity: 50,
    block: 'Pusat Islam KPMBP',
    level: 1,
    facilities: ['Sejadah & Karpet Penuh', 'Pendingin Hawa & Kipas', 'Tempat Wuduk Selesa', 'Sistem Pembesar Suara PA'],
    hasAircond: true,
    notes: 'Ruang solat dan pengajian Islam Aras Bawah'
  },
  {
    id: 'SURAU_2',
    code: 'SURAU 2',
    name: 'SURAU 2',
    category: 'Surau',
    capacity: 50,
    block: 'Pusat Islam KPMBP',
    level: 2,
    facilities: ['Sejadah & Karpet Penuh', 'Pendingin Hawa & Kipas', 'Tempat Wuduk Selesa', 'Sistem Pembesar Suara PA'],
    hasAircond: true,
    notes: 'Ruang solat dan pengajian Islam Aras Atas'
  }
];

// Master Timetable CSV dataset provided by KPM Bandar Penawar
export const MASTER_TIMETABLE_CSV = `Table X,Jadual Petempatan,Hari,8:30AM,9:30AM,10:30AM,11:30AM,12:30AM,1:30PM,2:30PM,3:30PM,4:30PM,5:30 PM
Table 36,L1 LIBRARY,1 - MON,LAW 2523 DLM 4B ADAM,,,,,,,,,
Table 36,L1 LIBRARY,2 - TUE,,,,,,,,,,
Table 36,L1 LIBRARY,3 - WED,LAW 2523 DLM 4F NASIHIN,,,,,,,,,
Table 36,L1 LIBRARY,4- THU,,,,,,,,,,
Table 36,L1 LIBRARY,5- FRI,,,,MGT 2513 DLM 4D NHB,MOHD NIZAM ABD GHANI,,,,,
Table 37,BLK. KOTA TINGGI,1 - MON,,,,,,,,,,
Table 37,BLK. KOTA TINGGI,2 - TUE,,,,,,,,,,
Table 37,BLK. KOTA TINGGI,3 - WED,,,,,,,,,,
Table 37,BLK. KOTA TINGGI,4- THU,,,,,,,,,,
Table 37,BLK. KOTA TINGGI,5- FRI,,,,,,,,,,
Table 01,BK01,1 - MON,,,,,,,,,,
Table 01,BK01,2 - TUE,,,,,,,,,,
Table 01,BK01,3 - WED,,,,,,,,,,
Table 01,BK01,4- THU,,,,,,,,,,
Table 01,BK01,5- FRI,,,,,,,,,,
Table 02,BK02,1 - MON,,,,,,,,,,
Table 2,BK02,2 - TUE,,,,,,,,,,
Table 2,BK02,3 - WED,,,,,,,,,,
Table 2,BK02,4- THU,,,,,,,,,,
Table 2,BK02,5- FRI,,,,,,,,,,
Table 03,BK03,1 - MON,COM 2512 DIA 4B SOLAHUDDIN ,,,LDALWM ADAM ,,,HAMIZULHAZRIN,,,
Table 03,BK03,2 - TUE,ETDRL2M5863A NAZHAN,,,LOG 3533 DLM 4E NOR LIZA BINTI RAMLIY CMILT,,,MPU2412 DIA 4D AZIMAH ABDUL RAZAK,,,
Table 03,BK03,3 - WED,LAW 2523 DLM4A ADAM,,,ECO 2023 DLM 4D NUR RAIDAH ABDUL LATIF CMILT,,,,,,
Table 03,BK03,4- THU,LAW 2523 DIA 3A NASIHIN,,,MAT 1013 DIA 1D NORHASNAH BT MOHD NORDIN CMILT,,,LOG 2603 DLM 4C DIYANA,,,
Table 03,BK03,5- FRI,MGT 2513 DLM 4F NHB,,NAZHAN,,,,,,,
Table 04,BK04,1 - MON,,,,,,,,,,
Table 04,BK04,2 - TUE,,,,,,,,,,
Table 04,BK04,3 - WED,,,,,,,,,,
Table 04,BK04,4- THU,,,,,,,,,,
Table 04,BK04,5- FRI,,,,,,,,,,
Table 05,BK05,1 - MON,,,,,,,,,,
Table 05,BK05,2 - TUE,,,,,,,,,,
Table 05,BK05,3 - WED,,,,,,,,,,
Table 05,BK05,4- THU,,,,,,,,,,
Table 05,BK05,5- FRI,,,,,,,,,,
Table 06,BK06,1 - MON,,,,,,,,,,
Table 06,BK06,2 - TUE,,,,,,,,,,
Table 06,BK06,3 - WED,,,,,,,,,,
Table 06,BK06,4- THU,,,,,,,,,,
Table 06,BK06,5- FRI,,,,,,,,,,
Table 07,BK07,1 - MON,,,,,,,,,,
Table 07,BK07,2 - TUE,,,,,,,,,,
Table 07,BK07,3 - WED,,,,,,,,,,
Table 07,BK07,4- THU,,,,,,,,,,
Table 07,BK07,5- FRI,,,,,,,,,,
Table 08,BK09,1- Isnin,NUR AFIFAH MOHD ROSLI,AFIFAH,AFIFAH,SOL / NAM,,,AKMAL BINTI ARIFF@FAUZI,AKMAL BINTI ARIFF@FAUZI,AKMAL BINTI ARIFF@FAUZI,
Table 08,BK09,2 - Selasa,TAHIRA ,TAHIRA ,TAHIRA ,NUR AFIFAH MOHD ROSLI,,,AKMAL BINTI ARIFF@FAUZI,AKMAL BINTI ARIFF@FAUZI,AKMAL BINTI ARIFF@FAUZI,
Table 08,BK09,3 - Rabu,AFIFAH,AFIFAH,AFIFAH,MUHAMMAD IBRAHIM AG DAMIT CMILT,,,SOLAHUDDIN ,SOLAHUDDIN ,SOLAHUDDIN ,
Table 08,BK09,4- THU,AFIFAH,,,DIYANA,,,AFIFAH,AFIFAH,AFIFAH,
Table 08,BK09,5- FRI,AZIMAH,,AFIFAH,,,,,,,
Table 09,BK10,1 - MON,,,,,,,,,,
Table 09,BK10,2 - TUE,,,,,,,,,,
Table 09,BK10,3 - WED,,,,,,,,,,
Table 09,BK10,4- THU,,,,,,,,,,
Table 09,BK10,5- FRI,,,,,,,,,,
Table 10,BK11,1 - MON,FARAH SHAHIDA,FARAH SHAHIDA,,FARAH SHAHIDA,FARAH SHAHIDA,,RAIDAH,RAIDAH,,
Table 10,BK11,2 - TUE,FARAH SHAHIDA,FARAH SHAHIDA,,NASIHIN,NASIHIN,,FARAH,FARAH,,
Table 10,BK11,3 - WED,SYAFIQAH,SYAFIQAH,,,FARAH SHAHIDA,,,,,
Table 10,BK11,4- THU,FARAH SHAHIDA,FARAH SHAHIDA,,,RAJA MOHAMAD SYAHMI RAJA ISMAIL,,MGT 2693 DLM 6B FS,,,
Table 10,BK11,5- FRI,FARAH SHAHIDA,,MGT 1013,,,,,,,
Table 11,BK12,1 - MON,DIA 4C,,,DLM 3B,,,DLM 4F,,,
Table 11,BK12,2 - TUE,DIA 4C,,,DIA 4A/HAQIMIE,,,,,,
Table 11,BK12,3 - WED,DIA 4D,,,DLM 4F,,,,,,
Table 11,BK12,4- THU,LOG 2063 DLM 3C SYAKIRAH BINTI MOHD GHAZALI CMILT,,,SYAKIRAH,,,MGT 1013 DLC 1B NHB,,,
Table 11,BK12,5- FRI,MGT 1013,,LOG 1053,,,,,,,
Table 12,BK13,1 - MON,,,,,,,,,,
Table 12,BK13,2 - TUE,,,,,,,,,,
Table 12,BK13,3 - WED,,,,,,,,,,
Table 12,BK13,4- THU,,,,,,,,,,
Table 12,BK13,5- FRI,,,,,,,,,,
Table 13,BK14,1 - MON,,,,,,,,,,
Table 13,BK14,2 - TUE,,,,,,,,,,
Table 13,BK14,3 - WED,,,,,,,,,,
Table 13,BK14,4- THU,,,,,,,,,,
Table 13,BK14,5- FRI,,,,,,,,,,
Table 14,BK15,1 - MON,LOG 2633 DLM 6B RABIAHTUL ,,,MGT 1013 DLS 1A HAMIZULHAZRIN BIN HASANI,,,NAZHAN,,,
Table 14,BK15,2 - TUE,LOG 2633 DLM 6C RABIAHTUL ,,,LOG 3533 DLM 4D SABRINA,,,LOG 2603 DLM 4E FAKHARUDDIN,,,
Table 14,BK15,3 - WED,LOG 2603 DLM 4D DIYANA,,,LOG 1053 DLC 1C NUR SYAFIQAH AHMAD SABRI CMILT,,,,,,
Table 14,BK15,4- THU,LOG 1033 DLC 1B FAKHARUDDIN,,,LOG 1053 DLS 1B SABRINA,,,,,,
Table 14,BK15,5- FRI,MGT 2023 DLM 3A FAKHRI HARITH I AIS,,ADAM,,,,,,,
Table 15,BK16,1 - MON,,,,,,,,,,
Table 15,BK16,2 - TUE,,,,,,,,,,
Table 15,BK16,3 - WED,,,,,,,,,,
Table 15,BK16,4- THU,,,,,,,,,,
Table 15,BK16,5- FRI,,,,,,,,,,
Table 16,BK17,1 - MON,LOG 2603 DLM 4E FAKHARUDDIN,,,,FAU,,,NASIHIN,,
Table 16,BK17,2 - TUE,MGT 1013 DLS 1B AISYA ,,,,RAJA MOHAMAD SYAHMI RAJA ISMAIL,,,SITI PAZILA ,,
Table 16,BK17,3 - WED,HAMIZUL,,,,FM,,,,,
Table 16,BK17,4- THU,LAW 2523 DLM 4C ADAM,,,,NORHASNAH BT MOHD NORDIN CMILT,MGT 2513 DLM 4C SPS,,LOG 1033 DLC 1C FAKHARUDDIN,,
Table 16,BK17,5- FRI,,,,MGT 1013 DLS 1B AIS,MUHAMMAD IBRAHIM AG DAMIT CMILT,,,,,
Table 17,BK18,1 - MON,HAZANIAH,,,,MPU 2162 DIA 3A REEZ ALIYA,,,FAKHARUDDIN,,
Table 17,BK18,2 - TUE,ECO 2023 DLM 4D NUR RAIDAH ABDUL LATIF CMILT,,,,,,,HAZANIAH,,
Table 17,BK18,3 - WED,,,,,LOG 1053 DLC 1C NUR SYAFIQAH AHMAD SABRI CMILT,,,,,
Table 17,BK18,4- THU,LOG 2563 DLM 3A LIZA,,,,LOG 3533 DLM 4F SITI RABIAHTUL ,,,LIZA,,
Table 17,BK18,5- FRI,,,,LAW 2523 DLM 4E NURUL NASIHIN ARIFFIN CMILT,,,,,,
Table 18,BK19,1 - MON,ACC 1133 DIA 3A/REEZ ALIYA NORMALA MD NOOR,,,,MAT 1013,,,,,
Table 18,BK19,2 - TUE,ACC 1133 DIA 3A/REEZ ALIYA NORMALA MD NOOR,,,,,,,,,
Table 18,BK19,3 - WED,LOG 2633 DLM6A RABIAHTUL ,,,,MAT 1013 DIA 1A SITI MUZLINDA NABIHAN ROSHIDI,,,,,
Table 18,BK19,4- THU,ACC 2682 DIA 6A RAFIE NFA,,,,MGTD2L6M936A AMIRUL HAKIM SHAHMINE AZIZUL FS,,,,,
Table 18,BK19,5- FRI,,,,ECO 2023 DLM 4C NUR RAIDAH ABDUL LATIF CMILT,,,,,,
Table 19,BK20,1 - MON,SYIFA,,,,DIA 4C,,,DIA 4D,,
Table 19,BK20,2 - TUE,ACC 2653 DIA 4A/ABID K/ HAQIMIE/NURIN,,,,ACC 2533 DIA 5A/AIDIL,,,FLG 1212 DLM 3B,,
Table 19,BK20,3 - WED,ACC2203 DIA 4C,,,,DIA 1A,,,,,
Table 19,BK20,4- THU,DIA 4A/HAQIMIE,,,,DIA 6A/RAFIE /AIDIL,,,DLS 1B,,
Table 19,BK20,5- FRI,MPU 2232 DLC 1A AKM,,,ACC2203 DIA 4D KHAIRANI HANUM KAMIL,,,,LAILI,,
Table 20,BK21,1 - MON,DLM 3B,,,,DIA 4D,,,DIA 3A/REEZ ALIYA,,
Table 20,BK21,2 - TUE,DIA 4D,,,,DIA 4D,,,DIA 6A/RAFIE /IMAN AIDIL,,
Table 20,BK21,3 - WED,DIA 4B,,,,DLM 4E,,,,,
Table 20,BK21,4- THU,DCAT 7C,,,,DIA 6A/RAFIE /AIDIL,,,DIA 4D,,
Table 20,BK21,5- FRI,FLG 1212,,,ACC 2653,,,,,,
Table 21,BK22,1 - MON,AZIMAH ABDUL RAZAK,,,,,MPU 2162 DLM 6C AZIMAH ABDUL RAZAK,,,,FIRZANAH
Table 21,BK22,2 - TUE,DLM 4C,,,,,DLM 4C,,,,DIA 4A/ABID K HAQIMIE
Table 21,BK22,3 - WED,FAU DCAT 7C,,,,FM DCAT 7C NORMALA MD NOOR,LOG 1053 DLS 1C,,,,
Table 21,BK22,4- THU,DLM 4D,,,,,DIA 4C,DLM 6C,,,DLC 1A
Table 21,BK22,5- FRI,MGT 1013,,FRIDAY,,ACC 2663,,,,,
Table 22,BK23,1 - MON,DLC 1B,,,DLS 1B,,,DLM 4E,,,
Table 22,BK23,2 - TUE,DLM 6B,,,DIA 6A/RAFIE /IMAN,,,,,,
Table 22,BK23,3 - WED,DLS 1C ANIS ARIANTI NORMAN,,ABID K HAQIMIE NURINAKM,DIA 4B RAJA MOHAMAD SYAHMI RAJA ISMAIL,,,,,,
Table 22,BK23,4- THU,MPU 2232 DLS 1C,MGT 1013 DLS 1C,,MPU 2232 DLS 1A,SOL / NAM,,ACC2203 DIA 4B,,,
Table 22,BK23,5- FRI,MPU 2232,,ACC 1013,,,,FAU,,,
Table 22,BK23,5- FRI,TAT,,NUR FIRZANAH AJAHAR,,,,,NURUS SYIFA SHAHARIMAN,,
Table 23,BK24,1 - MON,DIA 1D,,,,,DIA 4D,,,DIA 1B,
Table 23,BK24,2 - TUE,DCAT 7C,,,,,DCAT 7C,,,,
Table 23,BK24,3 - WED,DIA 5A/AIDIL/RAFIE,,,,,DCAT 7A,,,,
Table 23,BK24,4- THU,DIA 5A/AIDIL,,,,,,DLC 1C,,DIA 4A/ABID K HAQIMIE/NURIN,
Table 23,BK24,5- FRI,,,FRIDAY ASSEMBLY,,COM 2512 DIA 4D/SHAHMINE AZIZUL,COM 2512 DIA 4C SOL,,,,
Table 24,BK25,1 - Isnin,MUHAMMAD ZAKI MOHD ZUKI,,,,,,NORMALA MD NOOR,,,SABRINA
Table 24,BK25,2 - Selasa,SITI MARIAM BINTI MAZLAN,,,,,,MUHAMMAD ZAKI MOHD ZUKI,,,AHMAD KHAIRI MOHD
Table 24,BK25,3 - Rabu,SITI MUZLINDA NABIHAN ROSHIDI,,,,,,MUHAMMAD ZAKI MOHD ZUKI,,,
Table 24,BK25,4- Khamis,SITI MUZLINDA NABIHAN ROSHIDI,,,,,,NUR NAZHAN AHMAD KAMIL,,,NURUS SYIFA SHAHARIMAN
Table 24,BK25,5- FRI,,,,FM - DCAT 7C - NORMALA MD NOOR,,,,,,
Table 25,BK26,1 - MON,MPU 2232 DLS 1A ANIS ARIANTI NORMAN,,,ACC 1013 DIA 1C MARINA NASIR,,,MPU 2232 DLC 1C TAHIRA AZLIN TARIKH,,,
Table 25,BK26,2 - TUE,ACC 1013 DIA 1B MARINA NASIR,,,ACC 1013 DIA 1C MARINA NASIR,,,,,,
Table 25,BK26,3 - WED,ACC 1013 DIA 1A MARINA NASIR,,,ACC 1173 DIA 3A/NURIN MARINA NASIR,,,,,,
Table 25,BK26,4- THU,COM 2512 DIA 4C SOLAHUDDIN ,COM 2512 DIA 4C SOLAHUDDIN ,,ACC 1013 DIA 1B MARINA NASIR,,,ACC 1013 DIA 1A MARINA NASIR,,,
Table 25,BK26,5- FRI,COM 2512 DIA 4D/ SHAHMINE/ AZIZUL AAN,,ACC 1173 DIA 3A/NURIN MARINA NASIR,,,,,,,
Table 26,BK27,1 - MON,DIA 4D,,,,,DIA 5A/AIDIL/RAFIE,,,,
Table 26,BK27,2 - TUE,DLM 4E,,,,,,,,,
Table 26,BK27,3 - WED,ECO 1013 DLM 3C NUR RAIDAH ABDUL LATIF CMILT,,,,,MGT SITI PAZILA,,,,
Table 26,BK27,4- THU,MPU2162 DLM 6A AZIMAH,MGT 1013 DLC 1C,HH,,,ETR 2583 DIA 4B HAMIZULHAZRIN BIN HASANI,,,NAZHAN,
Table 26,BK27,5- FRI,,,,,LOG 2563 DLM 3B NOR LIZA BINTI RAMLIY CMILT,,,,,
Table 27,BK28,1 - MON,DIA 1C,,,,,,,,,
Table 27,BK28,2 - TUE,DLC 1B,,,,,,,,,
Table 27,BK28,3 - WED,DIA 1B,,,,,DCAT 7C,,,,
Table 27,BK28,4- THU,DLM 4F,,,,ECO 2023 DLM 4C NUR RAIDAH ABDUL LATIF CMILT,,,,,
Table 27,BK28,5- FRI,,,,ECO 2023,,,,,,
Table 38,DEWAN SEMINAR,1 - MON,LOG 2063 DLM 3C SYAKIRAH BINTI MOHD GHAZALI CMILT,,,,,,,,,
Table 38,DEWAN SEMINAR,2 - TUE,,,,,ETR 2583 DIA 4C ARNISHAHIDA MUHAMMAD CMILT,,,,,
Table 38,DEWAN SEMINAR,3 - WED,ETR 2583 DLM 6C NUR NAZHAN AHMAD KAMIL,,,,NORHASNAH BT MOHD NORDIN CMILT,,,,,
Table 38,DEWAN SEMINAR,4- THU,MGT 2513 DLM 4E NHB,,,,,,,,,
Table 38,DEWAN SEMINAR,5- FRI,,,,MGT 1013 DIA 1A SPS,,,,,,
Table 34,DKA,1 - MON,LAW 2523 DLM 4F NASIHIN,,,,,,,FAKHRUDDIN,,
Table 34,DKA,2 - TUE,ACC 2682 DIA 6A/RAFIE NUR FIRZANAH AJAHAR,,,,ETR 2583,,,TN SYED MOHD FADLY,,
Table 34,DKA,3 - WED,LOG 3533 DLM 4C SABRINA,,,,FLG 1212 DLM 3A QAIM/LUQ H/FAKHRI,,,,,
Table 34,DKA,4- THU,LOG 1053 DLS 1A NUR SYAFIQAH AHMAD SABRI CMILT,,,,MGT 1013,,,RAIDAH,,
Table 34,DKA,5- FRI,,,,,,,,,,
Table 35,DKB,1 - MON,FAU DCAT 7A/DCAT 7B MOHAMAD HELMI HAMID,,,,,,,SAFUAN,,
Table 35,DKB,2 - TUE,FAU DCAT 7A/DCAT 7B MOHAMAD HELMI HAMID,,,,HALIMATUL SAADIAH SAFAR CMILT,,,SABAHRIAH,,
Table 35,DKB,3 - WED,HAZANIAH,,,,,,,,,
Table 35,DKB,4- THU,MGT 2513 DLM 4B SPS,MGTD2L5M134A  SITI PAZILA,,,IBRAHIM,,,KOQ1021 TAM,,
Table 35,DKB,5- FRI,,,,,,,,,,
Table 29,LAB ALFA,1 - MON,DLS 1B,,,,DIA 4C,,,,,DIA 1A
Table 29,LAB ALFA,2 - TUE,DIA 1A,,,,DIA 1D,,,,,
Table 29,LAB ALFA,3 - WED,DCAT 7A,,,,DIA 1C,,,,,
Table 29,LAB ALFA,4- THU,DCAT 7A,,,,,DCAT 7B,,,,DIA 4C
Table 29,LAB ALFA,5- FRI,,,,LOG 2633,,,,,,FM
Table 30,LAB BETA,1 - MON,MGT 2023 DLM  AISYA ,,,,LIZA,,,,LOG 2603 DLM 4B DIYANA,
Table 30,LAB BETA,2 - TUE,DLM 4F,,,,DIA 6A/RAFIE /AIDIL,,,,,DCAT 7B
Table 30,LAB BETA,3 - WED,DIA 1D,,,,DIA 1D,,,,,
Table 30,LAB BETA,4- THU,DIA 1D,,,,,DCAT 7A,,,,
Table 30,LAB BETA,5- FRI,,,,ITE 1133,,,,,FAU,
Table 33,LAB DELTA,1 - MON,LOG 2603 DLM 4D DIYANA,,,,ZAKI ZUKI,,,SURAYA,,
Table 33,LAB DELTA,2 - TUE,LOG 2563 DLM 3B NOR LIZA BINTI RAMLIY CMILT,,,,LOG 3533 DLM 4B MOHD SYAMRIE NAZHARI CMILT,,,LIZA,,
Table 33,LAB DELTA,3 - WED,FM DCAT 7B NOR SAFUAN MOHD JAAFAR,,,,FM DCAT 7B/DCAT 7A NOR SAFUAN MOHD JAAFAR,,,,,
Table 33,LAB DELTA,4- THU,FM DCAT 7B NOR SAFUAN MOHD JAAFAR,,,,LAW 2053,,,,,
Table 33,LAB DELTA,5- FRI,,,,LOG 2603 DIYANA,,,,,,
Table 32,LAB GAMMA,1 - MON,LOG 3533 DLM 4A NAZHAN,,,,MGT 2023 DLM 3B AISYA ,,,SYAFIQAH ,,
Table 32,LAB GAMMA,2 - TUE,LOG 1033 DLS 1A MOHD SYAMRIE NAZHARI CMILT,,,,MGT 2023 DLM 3C AIS,,,SYAMRIE,,
Table 32,LAB GAMMA,3 - WED,LOG 1033 DLS 1B MOHD SYAMRIE NAZHARI CMILT,,,,LOG 3533 DLM 4B MOHD SYAMRIE NAZHARI CMILT,,,,,
Table 32,LAB GAMMA,4- THU,LOG 1033 DLS 1B MOHD SYAMRIE NAZHARI CMILT,,,,MGT 1013 DLS 1C AISYA ,,,,,
Table 32,LAB GAMMA,5- FRI,,,,SYAKIRAH,,,,,,
Table 31,LAB SIGMA,1 - MON,DLS 1C,,,,,DIA 1A,,,DLM 6C,
Table 31,LAB SIGMA,2 - TUE,LOG 1033 DLS 1C AMMIRU ,,,,,AMMIRU,,,,
Table 31,LAB SIGMA,3 - WED,DLM 6B,,,,,DLM 6C,,,,
Table 31,LAB SIGMA,4- THU,LOG 2633 DLM 6B RABIAHTUL ,,,,,AMMIRU,,,AMIRRU,
Table 31,LAB SIGMA,5- FRI,,,,FM,,,,,,
Table 39,MINI SEMINAR,1 - MON,MPU2412 DIA 4A/ABID K HAQIMIE/NURIN,,,,,,MGT 2513 DLM 4C,,,
Table 39,MINI SEMINAR,2 - TUE,MPU2412 DIA 4B AHMAD KHAIRI MOHD,,,ETR 2583 DLM 6B NUR NAZHAN AHMAD KAMIL,,,IBRAHIM,,,
Table 39,MINI SEMINAR,3 - WED,FLG 1212 DIA 3A/REEZ ALIYA HAQIMIE,,,LOG 2603 DLM 4B,,,,,,
Table 39,MINI SEMINAR,4- THU,DIA 4B,,,DLM 4F,,,,,,
Table 39,MINI SEMINAR,5- FRI,FLGD1I2A123A REEZ ALIYA HAQIMIEAFG,,LOG 2563 DLM 3C NOR LIZA BINTI RAMLIY CMILT,,,,,,,
Table 28,S. CLASSROOM,1 - MON,AKMAL BINTI ARIFF@FAUZI,AKMAL BINTI ARIFF@FAUZI,AKMAL BINTI ARIFF@FAUZI,IBRAHIM,ITE 1133 DIA 1C HALIMATUL SAADIAH SAFAR CMILT,,SOLAHUDDIN ,,,
Table 28,S. CLASSROOM,2 - TUE,SOLAHUDDIN ,SOLAHUDDIN ,AKMAL BINTI ARIFF@FAUZI,AKMAL BINTI ARIFF@FAUZI,AKMAL BINTI ARIFF@FAUZI,,,PD A,,
Table 28,S. CLASSROOM,3 - WED,PD B,,,DLC 1A,,,,PD B,,
Table 28,S. CLASSROOM,4- THU,PD A,,,PD A,,,DLM 4D,,,
Table 28,S. CLASSROOM,5- FRI,COM 2512,,ENG 1674,,,,ENG 1664,,,
Table 40,SURAU 1,1 - MON,AFIF BIN MAMAT,,,AFIF BIN MAMAT,,,,,,
Table 40,SURAU 1,2 - TUE,AFIF BIN MAMAT,,,AFIF BIN MAMAT,,,,,,
Table 40,SURAU 1,3 - WED,SYAKIRAH BINTI MOHD GHAZALI CMILT,,,AFIF BIN MAMAT,,,,,,
Table 40,SURAU 1,4- THU,AFIF BIN MAMAT,,,,AFIF BIN MAMAT,,,AFIF BIN MAMAT,,
Table 40,SURAU 1,5- JUMAAT,AFIF BIN MAMAT,,AFIF BIN MAMAT,AFIF BIN MAMAT,,,AFIF BIN MAMAT,,,
Table 41,SURAU 2,1 - MON,MOHD NIZAM ABD GHANI,,,MOHD NIZAM ABD GHANI,SITI JULIA ABAS,,MOHD NIZAM ABD GHANI,MOHD NIZAM ABD GHANI,,
Table 41,SURAU 2,2 - TUE,MOHD NIZAM ABD GHANI,,,MOHD NIZAM ABD GHANI,SITI JULIA ABAS,,,,,
Table 41,SURAU 2,3 - WED,,,,MOHD NIZAM ABD GHANI,SITI JULIA ABAS,,,,,
Table 41,SURAU 2,4- THU,,,,MOHD NIZAM ABD GHANI,SITI JULIA ABAS,,MOHD NIZAM ABD GHANI,MOHD NIZAM ABD GHANI,,
Table 41,SURAU 2,5- FRI,,,MOHD NIZAM ABD GHANI,MOHD NIZAM ABD GHANI,,,,,,`;

import { parseTimetableCSV } from '../utils/timetableCsvParser';

// Master Academic Schedule Parsed Directly from Official Master CSV
export const INITIAL_ACADEMIC_SCHEDULE: AcademicScheduleSlot[] = parseTimetableCSV(MASTER_TIMETABLE_CSV, INITIAL_ROOMS).slots;


// Operational Pilot Environment: Zero Demo Bookings (Real Activity Only)
export const INITIAL_ADHOC_BOOKINGS: AdHocBooking[] = [];

// Operational Pilot Environment: Zero Demo Institutional Blocks (Real Admin Locks Only)
export const INITIAL_INSTITUTIONAL_BLOCKS: InstitutionalBlock[] = [
  {
    id: 'EXAM-2026-DEWAN-BESAR',
    roomId: 'DEWAN_BESAR',
    date: '2026-11-02',
    endDate: '2026-11-16',
    startTime: '08:00',
    endTime: '24:00',
    title: 'Peperiksaan Akhir Semester Nov 2026',
    category: 'EXAM',
    createdBy: 'UPPK',
    reason: 'Peperiksaan Akhir Semester di Dewan Besar, Sri Penawar, Dewan Seminar & Mini Seminar (8:00 AM - 12:00 AM Midnight).',
    batchId: 'BATCH-EXAM-NOV-2026',
    isAllDay: true
  },
  {
    id: 'EXAM-2026-SRI-PENAWAR',
    roomId: 'SRI_PENAWAR',
    date: '2026-11-02',
    endDate: '2026-11-16',
    startTime: '08:00',
    endTime: '24:00',
    title: 'Peperiksaan Akhir Semester Nov 2026',
    category: 'EXAM',
    createdBy: 'UPPK',
    reason: 'Peperiksaan Akhir Semester di Dewan Besar, Sri Penawar, Dewan Seminar & Mini Seminar (8:00 AM - 12:00 AM Midnight).',
    batchId: 'BATCH-EXAM-NOV-2026',
    isAllDay: true
  },
  {
    id: 'EXAM-2026-DEWAN-SEMINAR',
    roomId: 'DEWAN_SEMINAR',
    date: '2026-11-02',
    endDate: '2026-11-16',
    startTime: '08:00',
    endTime: '24:00',
    title: 'Peperiksaan Akhir Semester Nov 2026',
    category: 'EXAM',
    createdBy: 'UPPK',
    reason: 'Peperiksaan Akhir Semester di Dewan Besar, Sri Penawar, Dewan Seminar & Mini Seminar (8:00 AM - 12:00 AM Midnight).',
    batchId: 'BATCH-EXAM-NOV-2026',
    isAllDay: true
  },
  {
    id: 'EXAM-2026-MINI-SEMINAR',
    roomId: 'MINI_SEMINAR',
    date: '2026-11-02',
    endDate: '2026-11-16',
    startTime: '08:00',
    endTime: '24:00',
    title: 'Peperiksaan Akhir Semester Nov 2026',
    category: 'EXAM',
    createdBy: 'UPPK',
    reason: 'Peperiksaan Akhir Semester di Dewan Besar, Sri Penawar, Dewan Seminar & Mini Seminar (8:00 AM - 12:00 AM Midnight).',
    batchId: 'BATCH-EXAM-NOV-2026',
    isAllDay: true
  }
];

// Official Standard Sample CSV for Locking Slots (Admin Sync Specification)
export const SAMPLE_LOCKED_SLOTS_CSV = `Perkara,Hari,"1
8:30 - 9:30","2
9:30 - 10:30","3
10:30 - 11:30","4
11:30 - 12:30","5
12:30 - 13:30","LUNCH
13:30 - 14:30","6
14:30 - 15:30","7
15:30 - 16:30","8
16:30 - 17:30"
SURAU 1,MON,AFIF,AFIF,,AFIF,AFIF,,,,
SURAU 1,TUE,AFIF,AFIF,,AFIF,AFIF,,,,
SURAU 1,WED,,,,AFIF,AFIF,,,,
SURAU 1,THU,AFIF,AFIF,,,AFIF,,,AFIF,
SURAU 1,FRI,AFIF,,AFIF,AFIF,,,AFIF,,
SURAU 2,MON,NIZAM,NIZAM,,NIZAM,NIZAM,,NIZAM,NIZAM,
SURAU 2,TUE,NIZAM,NIZAM,,NIZAM,NIZAM,,,,
SURAU 2,WED,,,,NIZAM,NIZAM,,,,
SURAU 2,THU,,,,NIZAM,NIZAM,,NIZAM,NIZAM,
SURAU 2,FRI,,,NIZAM,NIZAM,,,,,`;

export const STANDARD_GRID_TEMPLATE_CSV = `Perkara,Hari,"1
8:30 - 9:30","2
9:30 - 10:30","3
10:30 - 11:30","4
11:30 - 12:30","5
12:30 - 13:30","LUNCH
13:30 - 14:30","6
14:30 - 15:30","7
15:30 - 16:30","8
16:30 - 17:30"
SURAU 1,MON,AFIF,AFIF,,AFIF,AFIF,,,,
SURAU 1,TUE,AFIF,AFIF,,AFIF,AFIF,,,,
SURAU 1,WED,,,,AFIF,AFIF,,,,
SURAU 1,THU,AFIF,AFIF,,,AFIF,,,AFIF,
SURAU 1,FRI,AFIF,,AFIF,AFIF,,,AFIF,,
SURAU 2,MON,NIZAM,NIZAM,,NIZAM,NIZAM,,NIZAM,NIZAM,
SURAU 2,TUE,NIZAM,NIZAM,,NIZAM,NIZAM,,,,
SURAU 2,WED,,,,NIZAM,NIZAM,,,,
SURAU 2,THU,,,,NIZAM,NIZAM,,NIZAM,NIZAM,
SURAU 2,FRI,,,NIZAM,NIZAM,,,,,
BK01,MON,,,,,,,,,
BK01,TUE,,,,,,,,,
BK01,WED,,,,,,,,,
BK01,THU,,,,,,,,,
BK01,FRI,,,,,,,,,`;

