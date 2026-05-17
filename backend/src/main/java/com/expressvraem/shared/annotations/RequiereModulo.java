package com.expressvraem.shared.annotations;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marca un endpoint como protegido por módulo.
 * El usuario debe tener el módulo activo en usuario_modulos.
 * SUPER_ADMIN bypasea la verificación.
 *
 * Uso: @RequiereModulo("VENTAS")
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface RequiereModulo {
    String value();
}
