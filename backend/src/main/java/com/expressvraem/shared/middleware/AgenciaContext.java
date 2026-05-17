package com.expressvraem.shared.middleware;

public class AgenciaContext {

    private static final ThreadLocal<Long> agenciaId = new ThreadLocal<>();

    public static void setAgenciaId(Long id) {
        agenciaId.set(id);
    }

    public static Long getAgenciaId() {
        return agenciaId.get();
    }

    public static void clear() {
        agenciaId.remove();
    }
}
