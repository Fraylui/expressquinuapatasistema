package com.expressvraem.modules.caja.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "movimientos_caja")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class MovimientoCaja {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "agencia_id", nullable = false)
    private Long agenciaId;

    @Column(name = "caja_id", nullable = false)
    private Long cajaId;

    @Column(name = "usuario_id", nullable = false)
    private Long usuarioId;

    @Column(nullable = false, length = 20)
    private String tipo;

    @Column(nullable = false, length = 100)
    private String concepto;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal monto;

    @Column(name = "saldo_acumulado", precision = 10, scale = 2)
    private BigDecimal saldoAcumulado;

    @Column(name = "referencia_tipo", length = 30)
    private String referenciaTipo;

    @Column(name = "referencia_id")
    private Long referenciaId;

    /** PASAJE_COMBI | PASAJE_CAMIONETA | CUOTA_SALIDA_COMBI | ENCOMIENDA | ENC_PAGO_DESTINO | ENC_EXTERNA | OTRO */
    @Column(name = "categoria_ingreso", length = 30)
    private String categoriaIngreso;

    @Column(name = "viaje_id")
    private Long viajeId;

    @Column(name = "vehiculo_id")
    private Long vehiculoId;

    @Column(name = "tipo_vehiculo", length = 20)
    private String tipoVehiculo;

    @Column(name = "conductor_id")
    private Long conductorId;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        createdAt = LocalDateTime.now();
    }
}
