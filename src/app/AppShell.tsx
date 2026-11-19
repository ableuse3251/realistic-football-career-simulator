import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Briefcase,
  Cpu,
  Database,
  Play,
  RefreshCw,
  Shield,
  Trash2,
  User,
  Users,
} from 'lucide-react';
import {
  createSimEngine,
  detectPlatformCapabilities,
  type CareerMode,
  type EngineHandshakeInfo,
  type ISimEngine,
  type PlatformCapabilities,
  type PreviewClubFixture,
} from '../engine-adapter';
import {
  createStorageAdapter,
  type IStorageAdapter,
  type SaveSlotMetadata,
} from '../storage';

type NavSection = 'career' | 'clubs' | 'engine' | 'storage';

interface CareerModeMeta {
  id: CareerMode;
  title: string;
  subtitle: string;
  permissions: string[];
  restrictions: string[];
}

const CAREER_MODES: CareerModeMeta[] = [
  {
    id: 'manager',
    title: 'Менеджер клуба',
    subtitle: 'Полное стратегическое, финансовое и спортивное управление.',
    permissions: [
      'Трансферные переговоры и контракты',
      'Управление бюджетом, зарплатами и инфраструктурой',
      'Назначение и увольнение тренерского штаба',
      'Тактика, состав и ведение матчей',
    ],
    restrictions: [
      'Отчётность перед советом директоров и соблюдение FFP',
    ],
  },
  {
    id: 'head_coach',
    title: 'Главный тренер',
    subtitle: 'Фокус на тактике, тренировочных микроциклах и результате на поле.',
    permissions: [
      'Формации, индивидуальные роли и инструкции',
      'Недельные микроциклы тренировок и ротация',
      'Подготовка к соперникам, психология и замены',
      'Запросы руководству по усилению позиций',
    ],
    restrictions: [
      'Нет прямого утверждения сумм трансферов и контрактов',
    ],
  },
  {
    id: 'pro_player',
    title: 'Профессиональный футболист',
    subtitle: 'Личная карьера внутри живого футбольного мира.',
    permissions: [
      'Индивидуальный фокус тренировок и восстановления',
      'Выбор агента и личные контрактные переговоры',
      'Выполнение установок тренера на поле',
      'Решения о переходах и арендах',
    ],
    restrictions: [
      'Нет доступа к командной тактике, составу и бюджету клуба',
    ],
  },
];

export function AppShell() {
  const [section, setSection] = useState<NavSection>('career');
  const [selectedMode, setSelectedMode] = useState<CareerMode>('manager');
  const [capabilities] = useState<PlatformCapabilities>(() => detectPlatformCapabilities());

  const engineRef = useRef<ISimEngine | null>(null);
  const storageRef = useRef<IStorageAdapter | null>(null);

  const [handshake, setHandshake] = useState<EngineHandshakeInfo | null>(null);
  const [engineLoading, setEngineLoading] = useState(true);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [previewClubs, setPreviewClubs] = useState<PreviewClubFixture[]>([]);

  const [rngProbeResult, setRngProbeResult] = useState<string | null>(null);
  const [transferResult, setTransferResult] = useState<string | null>(null);

  const [storageReady, setStorageReady] = useState(false);
  const [storageBackend, setStorageBackend] = useState<string>('indexeddb');
  const [storageError, setStorageError] = useState<string | null>(null);
  const [slots, setSlots] = useState<SaveSlotMetadata[]>([]);
  const [storageLog, setStorageLog] = useState<string | null>(null);

  const initEngine = useCallback(async () => {
    setEngineLoading(true);
    setEngineError(null);
    engineRef.current?.dispose();
    try {
      const { engine, handshake: info } = await createSimEngine();
      engineRef.current = engine;
      setHandshake(info);
      setPreviewClubs(engine.getPreviewClubs());
    } catch (err) {
      setEngineError(err instanceof Error ? err.message : String(err));
    } finally {
      setEngineLoading(false);
    }
  }, []);

  const refreshSlots = useCallback(async () => {
    if (!storageRef.current) return;
    const list = await storageRef.current.listSlots();
    setSlots(list);
  }, []);

  useEffect(() => {
    void initEngine();
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, [initEngine]);

  useEffect(() => {
    let active = true;
    createStorageAdapter()
      .then(async (adapter) => {
        if (!active) return;
        storageRef.current = adapter;
        setStorageBackend(adapter.backend);
        setStorageReady(true);
        const list = await adapter.listSlots();
        if (active) setSlots(list);
      })
      .catch((err) => {
        if (!active) return;
        setStorageError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      active = false;
    };
  }, []);

  const handleRngProbe = async () => {
    if (!engineRef.current) return;
    const val = await engineRef.current.pingDeterministicRng(20261119, 1);
    if (val === null) {
      setRngProbeResult('Недоступно в режиме Preview Adapter (PRNG исполняется только в Rust/WASM).');
    } else {
      setRngProbeResult(`Seed (20261119, 1) → u32: ${val}`);
    }
  };

  const handleTransferTest = async () => {
    if (!engineRef.current) return;
    const res = await engineRef.current.testTransferableRoundtrip(16 * 1024);
    setTransferResult(
      `Передано ${res.transferredBytes.toLocaleString('ru-RU')} байт за ${res.durationMs.toFixed(2)} мс`
    );
  };

  const handleWriteTestSlot = async () => {
    if (!storageRef.current) return;
    setStorageError(null);
    try {
      const sample = new Uint8Array(4096);
      for (let i = 0; i < sample.length; i += 1) {
        sample[i] = i & 0xff;
      }
      const meta = await storageRef.current.writeSlot('stage2_selftest_slot', 1, sample);
      const loaded = await storageRef.current.readSlot('stage2_selftest_slot');
      if (!loaded || loaded.crc32 !== meta.crc32) {
        throw new Error('Контрольная сумма CRC32 не совпала после чтения.');
      }
      setStorageLog(
        `Слот "${meta.slotId}" записан и проверен: ${meta.byteLength} Б, CRC32 0x${meta.crc32
          .toString(16)
          .toUpperCase()}`
      );
      await refreshSlots();
    } catch (err) {
      setStorageError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!storageRef.current) return;
    await storageRef.current.deleteSlot(slotId);
    setStorageLog(`Слот "${slotId}" удалён.`);
    await refreshSlots();
  };

  const currentModeMeta = CAREER_MODES.find((m) => m.id === selectedMode) ?? CAREER_MODES[0];

  const sectionLabels: Record<NavSection, string> = {
    career: 'Режимы карьеры',
    clubs: 'Клубы (превью)',
    engine: 'Ядро Rust / WASM',
    storage: 'Локальное хранилище',
  };

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-100 flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="w-full lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-r border-slate-800 bg-[#0F172A] flex flex-col">
        <div className="px-5 py-4 border-b border-slate-800">
          <div className="text-base font-bold tracking-tight text-slate-50 whitespace-nowrap">
            Football Career Sim
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Этап 2 · Каркас и Handshake
          </div>
        </div>

        <nav className="p-3 flex lg:flex-col gap-1 overflow-x-auto" aria-label="Основная навигация">
          {(
            [
              { id: 'career', label: 'Карьера', icon: Briefcase },
              { id: 'clubs', label: 'Клубы', icon: Shield },
              { id: 'engine', label: 'Ядро WASM', icon: Cpu },
              { id: 'storage', label: 'Хранилище', icon: Database },
            ] as const
          ).map(({ id, label, icon: Icon }) => {
            const active = section === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setSection(id)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto hidden lg:block px-5 py-4 border-t border-slate-800 text-xs text-slate-400 space-y-1">
          <div>
            Режим ядра:{' '}
            <span className="text-slate-200 font-medium">
              {handshake?.mode === 'wasm-worker' ? 'Rust WASM' : 'Preview Adapter'}
            </span>
          </div>
          <div>
            Хранилище:{' '}
            <span className="text-slate-200 font-medium">
              {storageReady ? storageBackend : 'инициализация...'}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="px-6 py-4 border-b border-slate-800 bg-[#0B1120] flex items-center justify-between gap-8">
          <div className="text-sm text-slate-400 truncate">
            <span>Симулятор</span>
            <span className="mx-2 text-slate-600">/</span>
            <span className="text-slate-100 font-medium">{sectionLabels[section]}</span>
          </div>

          <button
            type="button"
            onClick={() => void initEngine()}
            disabled={engineLoading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold bg-[#16A34A] hover:bg-[#15803D] text-white transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${engineLoading ? 'animate-spin' : ''}`} />
            <span>Проверить ядро</span>
          </button>
        </header>

        <main className="flex-1 p-6 max-w-6xl w-full mx-auto space-y-8">
          {handshake?.mode === 'preview-fixture' && (
            <div className="border border-amber-500/30 bg-amber-950/20 rounded-lg px-4 py-3 text-sm text-amber-200">
              <div className="font-semibold text-amber-100">
                Активен изолированный Preview Adapter (WASM-пакет ещё не подключён)
              </div>
              <p className="mt-1 text-xs text-amber-200/80">
                В локальном превью нет скомпилированного файла <code className="font-mono">src/wasm-pkg/sim_wasm.js</code>.
                Отображаются только статические фикстуры интерфейса — вся игровая математика остаётся в Rust.
              </p>
            </div>
          )}

          {section === 'career' && (
            <section className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-50">
                  Три режима карьеры в едином мире
                </h1>
                <p className="mt-1 text-sm text-slate-400 max-w-2xl">
                  Менеджер, главный тренер и футболист работают поверх одного и того же состояния мира в Rust, но с разграничением прав управления.
                </p>
              </div>

              <div className="inline-flex p-1 bg-slate-900 border border-slate-800 rounded-lg gap-1">
                {(
                  [
                    { id: 'manager', label: 'Менеджер', icon: Briefcase },
                    { id: 'head_coach', label: 'Главный тренер', icon: Users },
                    { id: 'pro_player', label: 'Футболист', icon: User },
                  ] as const
                ).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedMode(id)}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
                      selectedMode === id
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              <div className="border border-slate-800 bg-[#111827] rounded-lg p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-slate-50">{currentModeMeta.title}</h2>
                  <p className="mt-1 text-sm text-slate-400">{currentModeMeta.subtitle}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-800">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-300 mb-3">
                      Доступные полномочия
                    </h3>
                    <ul className="space-y-2 text-sm text-slate-300">
                      {currentModeMeta.permissions.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <span className="text-[#16A34A] font-mono">✓</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold text-slate-300 mb-3">
                      Границы роли
                    </h3>
                    <ul className="space-y-2 text-sm text-slate-400">
                      {currentModeMeta.restrictions.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <span className="text-slate-500 font-mono">–</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </section>
          )}

          {section === 'clubs' && (
            <section className="space-y-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-50">
                  Клубы (статические фикстуры превью)
                </h1>
                <p className="mt-1 text-sm text-slate-400">
                  Процедурный генератор 18 000+ игроков и сотен клубов будет подключён на Этапе 3.
                </p>
              </div>

              <div className="border border-slate-800 bg-[#111827] rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs text-slate-400">
                        <th className="py-3 px-4 font-medium">Клуб</th>
                        <th className="py-3 px-4 font-medium">Лига</th>
                        <th className="py-3 px-4 font-medium text-right">Репутация</th>
                        <th className="py-3 px-4 font-medium text-right">Бюджет (€ млн)</th>
                        <th className="py-3 px-4 font-medium text-right">Состав</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 text-sm">
                      {previewClubs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 px-4 text-center text-slate-400">
                            База клубов ещё не сгенерирована (Этап 3).
                          </td>
                        </tr>
                      ) : (
                        previewClubs.map((club) => (
                          <tr key={club.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-4 font-medium text-slate-100">{club.name}</td>
                            <td className="py-3 px-4 text-slate-400">{club.league}</td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-200">
                              {club.reputation.toLocaleString('ru-RU')}
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-200">
                              {club.budgetEurMillions.toFixed(1)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-300">
                              {club.squadSize}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {section === 'engine' && (
            <section className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-50">
                  Проверка ядра Rust / WASM и Web Worker
                </h1>
                <p className="mt-1 text-sm text-slate-400">
                  Проверка совместимости среды, параметров фиксированного шага и обмена буферами без SharedArrayBuffer.
                </p>
              </div>

              {engineError && (
                <div className="border border-red-500/40 bg-red-950/30 rounded-lg p-4 text-sm text-red-200">
                  Ошибка инициализации: {engineError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border border-slate-800 bg-[#111827] rounded-lg p-5 space-y-3">
                  <h2 className="text-sm font-semibold text-slate-100">Параметры Handshake</h2>
                  {handshake ? (
                    <dl className="divide-y divide-slate-800 text-sm">
                      <div className="py-2 flex justify-between">
                        <dt className="text-slate-400">Активный адаптер</dt>
                        <dd className="font-mono text-slate-100">{handshake.mode}</dd>
                      </div>
                      <div className="py-2 flex justify-between">
                        <dt className="text-slate-400">ABI / Schema</dt>
                        <dd className="font-mono tabular-nums text-slate-100">
                          v{handshake.abiVersion} / v{handshake.schemaVersion}
                        </dd>
                      </div>
                      <div className="py-2 flex justify-between">
                        <dt className="text-slate-400">Решения / Физика мяча</dt>
                        <dd className="font-mono tabular-nums text-slate-100">
                          {handshake.tickHz} Гц / {handshake.ballPhysicsHz} Гц
                        </dd>
                      </div>
                      <div className="py-2 flex justify-between">
                        <dt className="text-slate-400">TickBuffer / MatchEvent</dt>
                        <dd className="font-mono tabular-nums text-slate-100">
                          {handshake.tickFrameBytes} Б / {handshake.matchEventBytes} Б
                        </dd>
                      </div>
                    </dl>
                  ) : (
                    <div className="text-sm text-slate-400">Выполняется инициализация...</div>
                  )}
                </div>

                <div className="border border-slate-800 bg-[#111827] rounded-lg p-5 space-y-3">
                  <h2 className="text-sm font-semibold text-slate-100">Совместимость платформы</h2>
                  <dl className="divide-y divide-slate-800 text-sm">
                    <div className="py-2 flex justify-between">
                      <dt className="text-slate-400">WebAssembly</dt>
                      <dd className="font-mono text-slate-100">
                        {capabilities.webAssemblySupported ? 'Поддерживается' : 'Нет'}
                      </dd>
                    </div>
                    <div className="py-2 flex justify-between">
                      <dt className="text-slate-400">Web Worker</dt>
                      <dd className="font-mono text-slate-100">
                        {capabilities.webWorkerSupported ? 'Поддерживается' : 'Нет'}
                      </dd>
                    </div>
                    <div className="py-2 flex justify-between">
                      <dt className="text-slate-400">IndexedDB</dt>
                      <dd className="font-mono text-slate-100">
                        {capabilities.indexedDbSupported ? 'Доступна' : 'Нет'}
                      </dd>
                    </div>
                    <div className="py-2 flex justify-between">
                      <dt className="text-slate-400">Оценка RAM устройства</dt>
                      <dd className="font-mono tabular-nums text-slate-100">
                        {capabilities.deviceMemoryGb !== null
                          ? `${capabilities.deviceMemoryGb} ГБ`
                          : 'Не раскрывается браузером'}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div className="border border-slate-800 bg-[#111827] rounded-lg p-5 space-y-4">
                <h2 className="text-sm font-semibold text-slate-100">Интерактивные проверки ABI</h2>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void handleTransferTest()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Тест Transferable ArrayBuffer (16 КБ)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRngProbe()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 transition-colors"
                  >
                    <Cpu className="w-3.5 h-3.5" />
                    <span>Проверить детерминированный PRNG</span>
                  </button>
                </div>
                {transferResult && (
                  <div className="text-xs font-mono text-slate-300">{transferResult}</div>
                )}
                {rngProbeResult && (
                  <div className="text-xs font-mono text-slate-300">{rngProbeResult}</div>
                )}
              </div>
            </section>
          )}

          {section === 'storage' && (
            <section className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-50">
                    Локальное хранилище ({storageBackend})
                  </h1>
                  <p className="mt-1 text-sm text-slate-400">
                    Единый Storage Adapter работает в Main Thread (IndexedDB в браузере, Capacitor SQLite на Android) с проверкой целостности CRC32.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={!storageReady}
                  onClick={() => void handleWriteTestSlot()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold bg-[#16A34A] hover:bg-[#15803D] text-white transition-colors whitespace-nowrap disabled:opacity-50"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Записать и проверить слот (4 КБ)</span>
                </button>
              </div>

              {storageError && (
                <div className="border border-red-500/40 bg-red-950/30 rounded-lg p-4 text-sm text-red-200">
                  {storageError}
                </div>
              )}

              {storageLog && (
                <div className="border border-slate-800 bg-slate-900/70 rounded-lg px-4 py-3 text-xs font-mono text-slate-200">
                  {storageLog}
                </div>
              )}

              <div className="border border-slate-800 bg-[#111827] rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs text-slate-400">
                      <th className="py-3 px-4 font-medium">Слот</th>
                      <th className="py-3 px-4 font-medium text-right">Схема</th>
                      <th className="py-3 px-4 font-medium text-right">Размер</th>
                      <th className="py-3 px-4 font-medium text-right">CRC32</th>
                      <th className="py-3 px-4 font-medium text-right">Действие</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-sm">
                    {slots.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 px-4 text-center text-slate-400">
                          Сохранённых слотов пока нет. Нажмите «Записать и проверить слот», чтобы протестировать запись и CRC32.
                        </td>
                      </tr>
                    ) : (
                      slots.map((slot) => (
                        <tr key={slot.slotId} className="hover:bg-slate-800/40">
                          <td className="py-3 px-4 font-mono text-xs text-slate-100">
                            {slot.slotId}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-300">
                            v{slot.schemaVersion}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-300">
                            {slot.byteLength.toLocaleString('ru-RU')} Б
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-300">
                            0x{slot.crc32.toString(16).toUpperCase()}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => void handleDeleteSlot(slot.slotId)}
                              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Удалить</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
