import { CountryCode } from '../domain/types';
import { ICountryEngine } from './BaseCountryEngine';
import { UruguayHREngine } from './UruguayHREngine';
import { ArgentinaHREngine } from './ArgentinaHREngine';
import { BrazilHREngine } from './BrazilHREngine';
import { UsaHREngine } from './UsaHREngine';

export class CountryEngineFactory {
  private static engines: Map<CountryCode, ICountryEngine> = new Map<CountryCode, ICountryEngine>([
    ['UY', new UruguayHREngine()],
    ['AR', new ArgentinaHREngine()],
    ['BR', new BrazilHREngine()],
    ['US', new UsaHREngine()],
  ]);

  public static getEngine(countryCode: CountryCode): ICountryEngine {
    const engine = this.engines.get(countryCode);
    if (!engine) {
      // Default fallback to Uruguay or US
      return this.engines.get('UY')!;
    }
    return engine;
  }

  public static getAllSupportedCountries(): { code: CountryCode; name: string; currency: string }[] {
    return Array.from(this.engines.values()).map(e => ({
      code: e.countryCode,
      name: e.countryName,
      currency: e.currency
    }));
  }
}
