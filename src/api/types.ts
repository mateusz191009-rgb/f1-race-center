// TypeScript models for the OpenF1 API (https://openf1.org/).
// Fields are typed loosely where the API may return null.

export interface Meeting {
  meeting_key: number
  meeting_name: string
  meeting_official_name: string
  location: string
  country_name: string
  country_code: string
  circuit_short_name: string
  circuit_key: number
  date_start: string
  gmt_offset: string
  year: number
}

export interface Session {
  session_key: number
  meeting_key: number
  session_name: string // "Race", "Qualifying", "Practice 1", "Sprint", ...
  session_type: string // "Race", "Qualifying", "Practice"
  date_start: string
  date_end: string
  location: string
  country_name: string
  circuit_short_name: string
  gmt_offset: string
  year: number
}

export interface Driver {
  driver_number: number
  broadcast_name: string
  full_name: string
  name_acronym: string // "VER", "HAM", ...
  team_name: string
  team_colour: string | null // hex without '#', e.g. "3671C6"
  first_name: string
  last_name: string
  headshot_url: string | null
  country_code: string | null
  session_key: number
  meeting_key: number
}

export interface LocationSample {
  driver_number: number
  date: string
  x: number
  y: number
  z: number
  session_key: number
  meeting_key: number
}

/** Compact, decimated location point (date already parsed to epoch ms). */
export interface CompactLoc {
  d: number // driver_number
  t: number // epoch ms
  x: number
  y: number
}

export interface Lap {
  driver_number: number
  lap_number: number
  date_start: string | null
  lap_duration: number | null
  duration_sector_1: number | null
  duration_sector_2: number | null
  duration_sector_3: number | null
  is_pit_out_lap: boolean
  i1_speed: number | null
  i2_speed: number | null
  st_speed: number | null
  session_key: number
}

export interface Interval {
  driver_number: number
  date: string
  gap_to_leader: number | string | null // number, or "+1 LAP"
  interval: number | string | null
  session_key: number
}

export interface PositionRecord {
  driver_number: number
  date: string
  position: number
  session_key: number
  meeting_key: number
}

export interface CarDataSample {
  driver_number: number
  date: string
  speed: number
  n_gear: number
  rpm: number
  drs: number
  throttle: number
  brake: number
  session_key: number
}

export interface RaceControlMessage {
  date: string
  category: string // "Flag", "SafetyCar", "Drs", "CarEvent", "Other", ...
  flag: string | null // "GREEN","YELLOW","DOUBLE YELLOW","RED","CLEAR","CHEQUERED","BLUE"
  scope: string | null // "Track","Sector","Driver"
  sector: number | null
  message: string
  driver_number: number | null
  lap_number: number | null
  session_key: number
  meeting_key: number
}

export interface WeatherSample {
  date: string
  air_temperature: number
  track_temperature: number
  humidity: number
  pressure: number
  rainfall: number
  wind_direction: number
  wind_speed: number
  session_key: number
}

export interface PitStop {
  driver_number: number
  date: string
  pit_duration: number | null
  lap_number: number
  session_key: number
}

export interface Stint {
  driver_number: number
  stint_number: number
  compound: string | null // "SOFT","MEDIUM","HARD","INTERMEDIATE","WET"
  lap_start: number
  lap_end: number
  tyre_age_at_start: number
  session_key: number
}

export interface TeamRadio {
  driver_number: number
  date: string
  recording_url: string
  session_key: number
  meeting_key: number
}
