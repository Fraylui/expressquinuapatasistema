package com.expressvraem.modules.promociones.repository;

import com.expressvraem.modules.promociones.entity.Promocion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PromocionRepository extends JpaRepository<Promocion, Long> {

    List<Promocion> findAllByOrderByActivaDescNombreAsc();

    List<Promocion> findByActivaTrueOrderByNombreAsc();

    Optional<Promocion> findByCodigoIgnoreCase(String codigo);

    @Modifying
    @Query("UPDATE Promocion p SET p.usosActuales = p.usosActuales + 1 WHERE p.id = :id")
    void incrementarUsoById(@Param("id") Long id);
}
