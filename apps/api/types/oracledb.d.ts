// Stub mínimo pero "namespace-friendly" para compilar en CI sin binarios nativos.
// Permite usar tipos como `oracledb.Connection` y valores como `oracledb.OUT_FORMAT_OBJECT`.

declare module "oracledb" {
  // 1) Namespace de tipos (para anotaciones tipo `oracledb.Connection`)
  namespace oracledb {
    interface ConnectionAttributes {
      user?: string;
      password?: string;
      connectString?: string;
      [k: string]: any;
    }

    interface PoolAttributes {
      user?: string;
      password?: string;
      connectString?: string;
      poolMin?: number;
      poolMax?: number;
      poolIncrement?: number;
      [k: string]: any;
    }

    interface ExecuteOptions {
      autoCommit?: boolean;
      outFormat?: number;
      [k: string]: any;
    }

    type BindParameters = Record<string, any> | any[];

    interface Result<T = any> {
      rows?: T[];
      rowsAffected?: number;
      outBinds?: Record<string, any> | any[];
      [k: string]: any;
    }

    interface Connection {
      execute<T = any>(
        sql: string,
        binds?: BindParameters,
        options?: ExecuteOptions
      ): Promise<Result<T>>;
      close(): Promise<void>;
      commit?(): Promise<void>;
      rollback?(): Promise<void>;
      [k: string]: any;
    }

    interface PoolConnection extends Connection {}

    interface Pool {
      getConnection(): Promise<PoolConnection>;
      close?(force?: boolean): Promise<void>;
      [k: string]: any;
    }
  }

  // 2) Interfaz de la exportación por defecto (valor en tiempo de ejecución)
  interface OracledbAPI {
    // Constantes más comunes
    OUT_FORMAT_OBJECT: number;
    OUT_FORMAT_ARRAY: number;
    BIND_IN?: number;
    BIND_OUT?: number;
    BIND_INOUT?: number;
    STRING?: number;
    NUMBER?: number;
    DATE?: number;

    // Métodos
    getConnection(
      attrs?: oracledb.ConnectionAttributes
    ): Promise<oracledb.Connection>;

    createPool(
      attrs?: oracledb.PoolAttributes
    ): Promise<oracledb.Pool>;

    // En algunos proyectos se usa getPool(); lo dejamos como any opcional
    getPool?(name?: string): any;

    // Cualquier otra propiedad
    [k: string]: any;
  }

  // 3) Export default compatible con CJS/ESM + namespace
  const oracledb: OracledbAPI;
  export = oracledb;
}
